import { Redis } from "@upstash/redis"
import type {
  BenchmarkRun,
  Donation,
  RunRequest,
  RunRequestStatus,
  SuiteQuestionBreakdown,
  SuiteRuntimeState,
} from "./types"

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required to initialize Redis`)
  }
  return value
}

// Initialize Redis client (Vercel KV uses these env var names)
export const redis = new Redis({
  url: requiredEnv("KV_REST_API_URL"),
  token: requiredEnv("KV_REST_API_TOKEN"),
})

// Key patterns
const KEYS = {
  suiteState: (id: string) => `suite:${id}:state`,
  suiteDonations: (id: string) => `suite:${id}:donations`,
  suiteRuns: (id: string) => `suite:${id}:runs`,
  appendRuns: (id: string) => `runs:${id}`,
  suiteLatest: (id: string) => `suite:${id}:latest`,
  suiteNotified: (id: string) => `suite:${id}:notified`,
  suiteQuestions: (id: string, version: string) =>
    `suite:${id}:questions:${version}`,
  suiteQuestionsLatest: (id: string) => `suite:${id}:questions:latest`,
  addressToSuite: (address: string) => `address:${address}`,
  runRequest: (id: string) => `runreq:${id}`,
  runRequestIndex: (suiteId: string) => `runreq-index:${suiteId}`,
  runRequestAllIndex: "runreq-index:all",
}

// Suite runtime state operations (JSON files are source of truth for static data)
export async function getSuiteState(
  id: string,
): Promise<SuiteRuntimeState | null> {
  return redis.get<SuiteRuntimeState>(KEYS.suiteState(id))
}

export async function setSuiteState(
  id: string,
  state: SuiteRuntimeState,
): Promise<void> {
  await redis.set(KEYS.suiteState(id), state)
}

export async function getSuiteIdByAddress(
  address: string,
): Promise<string | null> {
  return redis.get<string>(KEYS.addressToSuite(address))
}

export async function setAddressToSuite(
  address: string,
  suiteId: string,
): Promise<void> {
  await redis.set(KEYS.addressToSuite(address), suiteId)
}

// Donation operations
export async function addDonation(donation: Donation): Promise<void> {
  const timestamp = new Date(donation.timestamp).getTime()
  await redis.zadd(KEYS.suiteDonations(donation.suiteId), {
    score: timestamp,
    member: JSON.stringify(donation),
  })
}

export async function getDonations(
  suiteId: string,
  limit = 50,
): Promise<Donation[]> {
  const results = await redis.zrange<string[]>(
    KEYS.suiteDonations(suiteId),
    0,
    limit - 1,
    { rev: true },
  )
  return results.map((r) => JSON.parse(r) as Donation)
}

export async function getTotalDonationsSats(suiteId: string): Promise<number> {
  const donations = await getDonations(suiteId, 1000)
  return donations.reduce((sum, d) => sum + d.amountSats, 0)
}

// Benchmark run operations
export async function appendRun(
  suiteId: string,
  run: BenchmarkRun,
): Promise<void> {
  const timestamp = new Date(run.timestamp).getTime()
  const payload = JSON.stringify(run)
  await Promise.all([
    redis.set(KEYS.suiteLatest(suiteId), run),
    redis.lpush(KEYS.appendRuns(suiteId), payload),
    redis.ltrim(KEYS.appendRuns(suiteId), 0, 49),
    redis.zadd(KEYS.suiteRuns(suiteId), {
      score: timestamp,
      member: payload,
    }),
  ])
}

export async function addBenchmarkRun(run: BenchmarkRun): Promise<void> {
  await appendRun(run.suiteId, run)
}

export async function getLatestRun(
  suiteId: string,
): Promise<BenchmarkRun | null> {
  return redis.get<BenchmarkRun>(KEYS.suiteLatest(suiteId))
}

export async function getBenchmarkRuns(
  suiteId: string,
  limit = 20,
): Promise<BenchmarkRun[]> {
  return getRuns(suiteId, limit)
}

// Upstash auto-deserializes JSON on read, so a stored run may come back as an
// object OR (for values it could not parse) a raw string. Coerce both.
function coerceRun(value: unknown): BenchmarkRun | null {
  if (value == null) return null
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as BenchmarkRun
    } catch {
      return null
    }
  }
  return value as BenchmarkRun
}

export async function getRuns(
  suiteId: string,
  limit = 50,
): Promise<BenchmarkRun[]> {
  const appended = await redis.lrange<unknown>(
    KEYS.appendRuns(suiteId),
    0,
    limit - 1,
  )
  if (appended.length > 0) {
    return appended.map(coerceRun).filter((r): r is BenchmarkRun => r !== null)
  }

  const results = await redis.zrange<unknown[]>(
    KEYS.suiteRuns(suiteId),
    0,
    limit - 1,
    { rev: true },
  )
  if (results.length > 0) {
    return results.map(coerceRun).filter((r): r is BenchmarkRun => r !== null)
  }

  const legacy = await getLatestRun(suiteId)
  return legacy ? [legacy] : []
}

// Clear donations for a suite (after benchmark run)
export async function clearDonations(suiteId: string): Promise<void> {
  await redis.del(KEYS.suiteDonations(suiteId))
}

// Notification tracking - prevent duplicate funding notifications
export async function wasFundingNotificationSent(
  suiteId: string,
): Promise<boolean> {
  const notified = await redis.get<string>(KEYS.suiteNotified(suiteId))
  return notified === "true"
}

export async function markFundingNotificationSent(
  suiteId: string,
): Promise<void> {
  await redis.set(KEYS.suiteNotified(suiteId), "true")
}

export async function clearFundingNotification(suiteId: string): Promise<void> {
  await redis.del(KEYS.suiteNotified(suiteId))
}

// Utility to check if Redis is configured
export function isRedisConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

// Get latest run for a specific suite
export async function getLatestRunForSuite(
  suiteId: string,
): Promise<BenchmarkRun | null> {
  return getLatestRun(suiteId)
}

// Question breakdown operations
export async function setQuestionBreakdown(
  suiteId: string,
  version: string,
  data: SuiteQuestionBreakdown,
): Promise<void> {
  // Store both versioned and latest
  await Promise.all([
    redis.set(KEYS.suiteQuestions(suiteId, version), data),
    redis.set(KEYS.suiteQuestionsLatest(suiteId), data),
  ])
}

export async function getQuestionBreakdown(
  suiteId: string,
  version?: string,
): Promise<SuiteQuestionBreakdown | null> {
  if (version) {
    return redis.get<SuiteQuestionBreakdown>(
      KEYS.suiteQuestions(suiteId, version),
    )
  }
  return redis.get<SuiteQuestionBreakdown>(KEYS.suiteQuestionsLatest(suiteId))
}

export async function getStoredRunRequest(
  requestId: string,
): Promise<RunRequest | null> {
  return redis.get<RunRequest>(KEYS.runRequest(requestId))
}

export async function putRunRequest(request: RunRequest): Promise<void> {
  await Promise.all([
    redis.set(KEYS.runRequest(request.requestId), request),
    redis.sadd(KEYS.runRequestIndex(request.suiteId), request.requestId),
    redis.sadd(KEYS.runRequestAllIndex, request.requestId),
  ])
}

export async function getRunRequestIds(suiteId?: string): Promise<string[]> {
  if (suiteId) {
    return redis.smembers<string[]>(KEYS.runRequestIndex(suiteId))
  }
  return redis.smembers<string[]>(KEYS.runRequestAllIndex)
}

export async function updateRunRequestStatus(
  requestId: string,
  status: RunRequestStatus,
): Promise<RunRequest | null> {
  const request = await getStoredRunRequest(requestId)
  if (!request) return null

  const next: RunRequest = { ...request, status }
  await redis.set(KEYS.runRequest(requestId), next)
  return next
}
