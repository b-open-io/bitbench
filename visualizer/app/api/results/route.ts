import { NextResponse } from "next/server"
import { getLatestRun, isRedisConfigured } from "@/lib/kv"
import { getAllSuites } from "@/lib/suites"
import { type Chain, isChain, type ModelResult, type TestSuite } from "@/lib/types"

/** How a suite's primary score should be read. Never average across kinds. */
export type MetricKind = "accuracy" | "leaning"

export interface SuiteRunSummary {
  suiteId: string
  suiteName: string
  chain: Chain
  description: string
  timestamp: string
  version: string
  totalModels: number
  totalTests: number
  metricKind: MetricKind
  topPerformer: {
    model: string
    score: number
    leaning?: number
  } | null
  totalCost: number
}

export interface IndexEntry {
  model: string
  averageScore: number
  suitesParticipated: number
  totalCost: number
}

export interface IndexSuite {
  id: string
  name: string
}

export interface NamedIndex {
  id: string
  name: string
  /** Short score column label, e.g. "Accuracy" */
  metricLabel: string
  metricKind: MetricKind
  /** Benchmarks that compose this index (positive inclusion list) */
  suites: IndexSuite[]
  models: IndexEntry[]
}

export interface AggregatedResults {
  totalCompletedSuites: number
  totalModelsEvaluated: number
  totalTestsExecuted: number
  latestRun: SuiteRunSummary | null
  suiteRuns: SuiteRunSummary[]
  knowledgeIndex: NamedIndex
  /** Alias of knowledgeIndex.models for older clients */
  globalLeaderboard: IndexEntry[]
}

function isSuiteRunSummary(
  summary: SuiteRunSummary | null,
): summary is SuiteRunSummary {
  return summary !== null
}

function isKnowledgeSuite(suite: TestSuite): boolean {
  return suite.chain !== "ai"
}

function metricKindForRun(rankings: ModelResult[]): MetricKind {
  const isPhilosophy = rankings.some(
    (r) =>
      r.leaning !== undefined ||
      (r.positionTotal !== undefined && r.positionTotal > 0),
  )
  return isPhilosophy ? "leaning" : "accuracy"
}

/**
 * Mean accuracy over the given knowledge suites. Models must have results on
 * every suite in the set (equal coverage).
 */
function buildKnowledgeIndex(
  knowledgeRuns: Array<{
    suiteId: string
    suiteName: string
    rankings: ModelResult[]
  }>,
): NamedIndex {
  const suites: IndexSuite[] = knowledgeRuns
    .map(({ suiteId, suiteName }) => ({ id: suiteId, name: suiteName }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const requiredCount = suites.length
  const suiteIds = new Set(suites.map((s) => s.id))

  const byModel = new Map<
    string,
    { totalScore: number; count: number; totalCost: number; suiteIds: Set<string> }
  >()

  for (const { suiteId, rankings } of knowledgeRuns) {
    if (!suiteIds.has(suiteId)) {
      throw new Error(`Unexpected suite ${suiteId} outside knowledge index set`)
    }
    for (const result of rankings) {
      const existing = byModel.get(result.model) ?? {
        totalScore: 0,
        count: 0,
        totalCost: 0,
        suiteIds: new Set<string>(),
      }
      if (existing.suiteIds.has(suiteId)) {
        throw new Error(
          `Duplicate ranking for model ${result.model} on suite ${suiteId}`,
        )
      }
      existing.suiteIds.add(suiteId)
      existing.totalScore += result.score
      existing.count += 1
      existing.totalCost += result.cost
      byModel.set(result.model, existing)
    }
  }

  const models: IndexEntry[] = []
  for (const [model, data] of byModel.entries()) {
    if (requiredCount === 0 || data.count !== requiredCount) continue
    models.push({
      model,
      averageScore: data.totalScore / data.count,
      suitesParticipated: data.count,
      totalCost: data.totalCost,
    })
  }

  models.sort((a, b) => b.averageScore - a.averageScore)

  return {
    id: "bitcoin-knowledge",
    name: "Bitcoin Knowledge Index",
    metricLabel: "Accuracy",
    metricKind: "accuracy",
    suites,
    models,
  }
}

function emptyKnowledgeIndex(): NamedIndex {
  return {
    id: "bitcoin-knowledge",
    name: "Bitcoin Knowledge Index",
    metricLabel: "Accuracy",
    metricKind: "accuracy",
    suites: [],
    models: [],
  }
}

export async function GET() {
  if (!isRedisConfigured()) {
    return NextResponse.json({
      totalCompletedSuites: 0,
      totalModelsEvaluated: 0,
      totalTestsExecuted: 0,
      latestRun: null,
      suiteRuns: [],
      knowledgeIndex: emptyKnowledgeIndex(),
      globalLeaderboard: [],
    } satisfies AggregatedResults)
  }

  try {
    const allSuites = await getAllSuites()

    const suiteMap = new Map<string, TestSuite>()
    for (const suite of allSuites) {
      if (!isChain(suite.chain)) {
        throw new Error(`Unknown chain "${suite.chain}" for suite ${suite.id}`)
      }
      suiteMap.set(suite.id, suite)
    }

    const completedSuites = allSuites.filter((s) => s.status === "completed")
    const runsWithSuites = await Promise.all(
      completedSuites.map(async (suite) => {
        const run = await getLatestRun(suite.id)
        return { suiteId: suite.id, run }
      }),
    )

    const allLatestRuns = runsWithSuites.filter(
      (r): r is { suiteId: string; run: NonNullable<typeof r.run> } =>
        r.run !== null,
    )

    const suiteRunSummaries = allLatestRuns.map(({ suiteId, run }) => {
      const suite = suiteMap.get(suiteId)
      if (!suite) return null

      const metricKind = metricKindForRun(run.rankings)
      const top = run.rankings[0]
      const topPerformer = top
        ? {
            model: top.model,
            score: top.score,
            ...(metricKind === "leaning" && top.leaning !== undefined
              ? { leaning: top.leaning }
              : {}),
          }
        : null

      return {
        suiteId,
        suiteName: suite.name,
        chain: suite.chain,
        description: suite.description,
        timestamp: run.timestamp,
        version: run.version,
        totalModels: run.rankings.length,
        totalTests: run.rankings.reduce((sum, r) => sum + r.total, 0),
        metricKind,
        topPerformer,
        totalCost: run.totalCost,
      }
    })

    const suiteRuns: SuiteRunSummary[] = suiteRunSummaries
      .filter(isSuiteRunSummary)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )

    const knowledgeRuns = allLatestRuns
      .map(({ suiteId, run }) => {
        const suite = suiteMap.get(suiteId)
        if (!suite || !isKnowledgeSuite(suite)) return null
        return {
          suiteId,
          suiteName: suite.name,
          rankings: run.rankings,
        }
      })
      .filter(
        (
          r,
        ): r is {
          suiteId: string
          suiteName: string
          rankings: ModelResult[]
        } => r !== null,
      )

    const knowledgeIndex = buildKnowledgeIndex(knowledgeRuns)

    const uniqueModels = new Set<string>()
    let totalTests = 0
    for (const { run } of allLatestRuns) {
      for (const result of run.rankings) {
        uniqueModels.add(result.model)
        totalTests += result.total
      }
    }

    return NextResponse.json({
      totalCompletedSuites: suiteRuns.length,
      totalModelsEvaluated: uniqueModels.size,
      totalTestsExecuted: totalTests,
      latestRun: suiteRuns[0] || null,
      suiteRuns,
      knowledgeIndex,
      globalLeaderboard: knowledgeIndex.models,
    } satisfies AggregatedResults)
  } catch (error) {
    console.error("Failed to get aggregated results:", error)
    return NextResponse.json(
      { error: "Failed to get results" },
      { status: 500 },
    )
  }
}
