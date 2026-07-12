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
  /** Primary metric unit for this suite */
  metricKind: MetricKind
  topPerformer: {
    model: string
    /** Accuracy % or positionRate %, depending on metricKind */
    score: number
    /** Present when metricKind is leaning */
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

export interface NamedIndex {
  id: string
  name: string
  description: string
  /** Display label for the score column */
  metricLabel: string
  metricKind: MetricKind
  /** Suites that define this index (equal coverage required) */
  requiredSuiteIds: string[]
  models: IndexEntry[]
}

export interface AggregatedResults {
  totalCompletedSuites: number
  totalModelsEvaluated: number
  totalTestsExecuted: number
  latestRun: SuiteRunSummary | null
  suiteRuns: SuiteRunSummary[]
  /**
   * Named aggregate over knowledge (chain) suites only.
   * Philosophy / AI-values suites never enter this index.
   */
  knowledgeIndex: NamedIndex
  /**
   * @deprecated Prefer knowledgeIndex. Kept as an alias of knowledgeIndex.models
   * so older clients that still read globalLeaderboard do not mix units.
   */
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
 * Bitcoin Knowledge Index: mean accuracy across a fixed set of completed
 * knowledge suites. Models missing any required suite are excluded (fail hard
 * on unequal coverage — never average whatever happens to be present).
 */
function buildKnowledgeIndex(
  knowledgeRuns: Array<{ suiteId: string; rankings: ModelResult[] }>,
): NamedIndex {
  const requiredSuiteIds = knowledgeRuns.map((r) => r.suiteId).sort()
  const requiredCount = requiredSuiteIds.length

  const byModel = new Map<
    string,
    { totalScore: number; count: number; totalCost: number; suiteIds: Set<string> }
  >()

  for (const { suiteId, rankings } of knowledgeRuns) {
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
    if (data.count !== requiredCount) {
      // Unequal coverage — exclude rather than silently partial-average
      continue
    }
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
    description:
      requiredCount === 0
        ? "No completed knowledge suites yet. AI values suites are listed separately and never enter this index."
        : `Mean accuracy across ${requiredCount} completed knowledge suite${requiredCount === 1 ? "" : "s"}. Models must have results on every required suite. Philosophy and other AI-values suites are excluded.`,
    metricLabel: "Accuracy (%)",
    metricKind: "accuracy",
    requiredSuiteIds,
    models,
  }
}

export async function GET() {
  if (!isRedisConfigured()) {
    const emptyIndex: NamedIndex = {
      id: "bitcoin-knowledge",
      name: "Bitcoin Knowledge Index",
      description: "Redis not configured.",
      metricLabel: "Accuracy (%)",
      metricKind: "accuracy",
      requiredSuiteIds: [],
      models: [],
    }
    return NextResponse.json({
      totalCompletedSuites: 0,
      totalModelsEvaluated: 0,
      totalTestsExecuted: 0,
      latestRun: null,
      suiteRuns: [],
      knowledgeIndex: emptyIndex,
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
        return { suiteId, rankings: run.rankings }
      })
      .filter(
        (r): r is { suiteId: string; rankings: ModelResult[] } => r !== null,
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

    const response: AggregatedResults = {
      totalCompletedSuites: suiteRuns.length,
      totalModelsEvaluated: uniqueModels.size,
      totalTestsExecuted: totalTests,
      latestRun: suiteRuns[0] || null,
      suiteRuns,
      knowledgeIndex,
      // Alias: same data as knowledge index only — never mixed philosophy scores
      globalLeaderboard: knowledgeIndex.models,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to get aggregated results:", error)
    return NextResponse.json(
      { error: "Failed to get results" },
      { status: 500 },
    )
  }
}
