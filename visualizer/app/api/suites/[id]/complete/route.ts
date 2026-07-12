import { parseAuthToken, verifyAuthToken } from "bitcoin-auth"
import { type NextRequest, NextResponse } from "next/server"
import { getMasterPublicKey, isMasterWifConfigured } from "@/lib/addresses"
import { appendRun, isRedisConfigured, setSuiteState } from "@/lib/kv"
import { getRunRequest, setRunRequestStatus } from "@/lib/run-requests"
import type { BenchmarkRun, SuiteRuntimeState } from "@/lib/types"

interface CompletionPayload {
  suiteId: string
  suiteName: string
  chain: string
  version: string
  timestamp: string
  rankings: Array<{
    model: string
    correct: number
    incorrect: number
    errors: number
    totalTests: number
    successRate: number
    totalCost: number
    tokensPerSecond: number
    /** Mean wall-clock latency per cell (ms) */
    averageDuration?: number
    positionRate?: number
    positionCorrect?: number
    positionTotal?: number
    complianceRate?: number
    complianceCorrect?: number
    complianceTotal?: number
    leaning?: number
  }>
  metadata: {
    totalModels: number
    totalTestsRun: number
    overallSuccessRate: number
    totalCost: number
    overallPositionRate?: number
    overallComplianceRate?: number
    overallLeaning?: number
  }
  requestId?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: suiteId } = await params

  // Check configuration
  if (!isRedisConfigured()) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 })
  }

  if (!isMasterWifConfigured()) {
    return NextResponse.json(
      { error: "Server not configured for authentication" },
      { status: 500 },
    )
  }

  // Get auth token from header
  const authToken = request.headers.get("bitcoin-auth-token")
  if (!authToken) {
    return NextResponse.json(
      { error: "Missing Bitcoin-Auth-Token header" },
      { status: 401 },
    )
  }

  // Parse token to get pubkey
  const parsedToken = parseAuthToken(authToken)
  if (!parsedToken) {
    return NextResponse.json(
      { error: "Invalid auth token format" },
      { status: 401 },
    )
  }

  // Verify pubkey matches expected (from MASTER_WIF)
  const expectedPubkey = getMasterPublicKey()
  if (parsedToken.pubkey !== expectedPubkey) {
    return NextResponse.json(
      { error: "Unauthorized: pubkey mismatch" },
      { status: 403 },
    )
  }

  // Get request body
  const body = await request.text()
  if (!body) {
    return NextResponse.json({ error: "Missing request body" }, { status: 400 })
  }

  // Verify signature
  const requestPath = `/api/suites/${suiteId}/complete`
  const isValid = verifyAuthToken(authToken, {
    requestPath,
    timestamp: new Date().toISOString(),
    body,
  })

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Parse and validate payload
  let payload: CompletionPayload
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate suite ID matches
  if (payload.suiteId !== suiteId) {
    return NextResponse.json({ error: "Suite ID mismatch" }, { status: 400 })
  }

  // Transform payload to BenchmarkRun format
  const benchmarkRun: BenchmarkRun = {
    id: `${suiteId}-${payload.version}-${Date.now()}`,
    suiteId,
    version: payload.version,
    timestamp: payload.timestamp,
    rankings: payload.rankings.map((r) => ({
      model: r.model,
      provider: "", // Not tracked in CLI output
      // Philosophy suites: primary score is position rate; else folded successRate
      score:
        r.positionRate !== undefined && r.positionTotal && r.positionTotal > 0
          ? r.positionRate
          : r.successRate,
      correct: r.correct,
      total: r.totalTests,
      avgResponseTime:
        typeof r.averageDuration === "number" && r.averageDuration >= 0
          ? r.averageDuration
          : 0,
      cost: r.totalCost,
      tokensPerSecond: r.tokensPerSecond,
      ...(r.positionRate !== undefined
        ? {
            positionRate: r.positionRate,
            positionCorrect: r.positionCorrect,
            positionTotal: r.positionTotal,
            leaning: r.leaning,
          }
        : {}),
      ...(r.complianceRate !== undefined
        ? {
            complianceRate: r.complianceRate,
            complianceCorrect: r.complianceCorrect,
            complianceTotal: r.complianceTotal,
          }
        : {}),
    })),
    totalCost: payload.metadata.totalCost,
    duration: 0, // Not tracked
    ...(payload.requestId ? { requestId: payload.requestId } : {}),
  }

  try {
    // Store benchmark run in KV
    await appendRun(suiteId, benchmarkRun)

    if (payload.requestId) {
      const runRequest = await getRunRequest(payload.requestId)
      if (runRequest && runRequest.suiteId === suiteId) {
        await setRunRequestStatus(payload.requestId, "completed")
      }
    }

    // Update suite state to completed
    const newState: SuiteRuntimeState = {
      status: "completed",
      lastRunAt: payload.timestamp,
      lastRunVersion: payload.version,
    }
    await setSuiteState(suiteId, newState)

    return NextResponse.json({
      success: true,
      message: "Benchmark results stored successfully",
      runId: benchmarkRun.id,
    })
  } catch (error) {
    console.error("Failed to store benchmark results:", error)
    return NextResponse.json(
      { error: "Failed to store results" },
      { status: 500 },
    )
  }
}
