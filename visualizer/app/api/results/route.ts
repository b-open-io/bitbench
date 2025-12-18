import { NextResponse } from "next/server";
import { getLatestRun, isRedisConfigured } from "@/lib/kv";
import { getAllSuites } from "@/lib/suites";
import type { TestSuite } from "@/lib/types";

interface SuiteRunSummary {
  suiteId: string;
  suiteName: string;
  chain: string;
  description: string;
  timestamp: string;
  version: string;
  totalModels: number;
  totalTests: number;
  topPerformer: {
    model: string;
    score: number;
  } | null;
  totalCost: number;
}

interface AggregatedResults {
  totalCompletedSuites: number;
  totalModelsEvaluated: number;
  totalTestsExecuted: number;
  latestRun: SuiteRunSummary | null;
  suiteRuns: SuiteRunSummary[];
  globalLeaderboard: Array<{
    model: string;
    averageScore: number;
    suitesParticipated: number;
    totalCost: number;
  }>;
}

export async function GET() {
  if (!isRedisConfigured()) {
    // Return mock data for development
    return NextResponse.json({
      totalCompletedSuites: 0,
      totalModelsEvaluated: 0,
      totalTestsExecuted: 0,
      latestRun: null,
      suiteRuns: [],
      globalLeaderboard: [],
    } satisfies AggregatedResults);
  }

  try {
    const allSuites = await getAllSuites();

    // Create a map of suite ID to suite data
    const suiteMap = new Map<string, TestSuite>();
    for (const suite of allSuites) {
      suiteMap.set(suite.id, suite);
    }

    // Get latest runs for completed suites
    const completedSuites = allSuites.filter((s) => s.status === "completed");
    const runsWithSuites = await Promise.all(
      completedSuites.map(async (suite) => {
        const run = await getLatestRun(suite.id);
        return { suiteId: suite.id, run };
      })
    );

    const allLatestRuns = runsWithSuites.filter(
      (r): r is { suiteId: string; run: NonNullable<typeof r.run> } =>
        r.run !== null
    );

    // Transform runs into summaries
    const suiteRuns: SuiteRunSummary[] = allLatestRuns
      .map(({ suiteId, run }) => {
        const suite = suiteMap.get(suiteId);
        if (!suite) return null;

        const topPerformer =
          run.rankings.length > 0
            ? {
                model: run.rankings[0].model,
                score: run.rankings[0].score,
              }
            : null;

        return {
          suiteId,
          suiteName: suite.name,
          chain: suite.chain,
          description: suite.description,
          timestamp: run.timestamp,
          version: run.version,
          totalModels: run.rankings.length,
          totalTests: run.rankings.reduce((sum, r) => sum + r.total, 0),
          topPerformer,
          totalCost: run.totalCost,
        };
      })
      .filter((r): r is SuiteRunSummary => r !== null)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    // Calculate global leaderboard by aggregating across all suites
    const modelScores = new Map<
      string,
      { totalScore: number; count: number; totalCost: number }
    >();

    for (const { run } of allLatestRuns) {
      for (const result of run.rankings) {
        const existing = modelScores.get(result.model) || {
          totalScore: 0,
          count: 0,
          totalCost: 0,
        };
        existing.totalScore += result.score;
        existing.count += 1;
        existing.totalCost += result.cost;
        modelScores.set(result.model, existing);
      }
    }

    const globalLeaderboard = Array.from(modelScores.entries())
      .map(([model, data]) => ({
        model,
        averageScore: data.totalScore / data.count,
        suitesParticipated: data.count,
        totalCost: data.totalCost,
      }))
      .sort((a, b) => b.averageScore - a.averageScore); // Return ALL models

    // Calculate totals
    const uniqueModels = new Set<string>();
    let totalTests = 0;
    for (const { run } of allLatestRuns) {
      for (const result of run.rankings) {
        uniqueModels.add(result.model);
        totalTests += result.total;
      }
    }

    const response: AggregatedResults = {
      totalCompletedSuites: suiteRuns.length,
      totalModelsEvaluated: uniqueModels.size,
      totalTestsExecuted: totalTests,
      latestRun: suiteRuns[0] || null,
      suiteRuns,
      globalLeaderboard,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get aggregated results:", error);
    return NextResponse.json(
      { error: "Failed to get results" },
      { status: 500 }
    );
  }
}
