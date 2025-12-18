"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  Trophy,
  BarChart3,
  Clock,
  Target,
  DollarSign,
  ArrowLeft,
  ArrowRight,
  Medal,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { ChainBadge } from "@/components/chain-badge";

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

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ResultsPage() {
  const [resultsData, setResultsData] = useState<AggregatedResults | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch("/api/results");
        if (res.ok) {
          const data = await res.json();
          setResultsData(data);
        }
      } catch (error) {
        console.error("Failed to fetch results:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, []);

  if (loading) {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <SiteHeader modelCount={44} />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(from_var(--primary)_l_c_h/0.12),transparent)]" />

      <SiteHeader modelCount={44} />

      <main className="relative mx-auto max-w-7xl px-4 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Funding
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Benchmark Results
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          AI model performance across all completed benchmark suites.
        </p>

        {resultsData && resultsData.totalCompletedSuites > 0 ? (
          <div className="space-y-8">
            {/* Hero Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>Completed Benchmarks</CardDescription>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Trophy className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {resultsData.totalCompletedSuites}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Test suites completed
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>Models Evaluated</CardDescription>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {resultsData.totalModelsEvaluated}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI models tested
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>Tests Executed</CardDescription>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Target className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {resultsData.totalTestsExecuted.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Questions answered
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>Latest Run</CardDescription>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {resultsData.latestRun
                      ? formatRelativeTime(resultsData.latestRun.timestamp)
                      : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {resultsData.latestRun?.suiteName || "No runs yet"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Global Leaderboard */}
            {resultsData.globalLeaderboard.length > 0 && (
              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Top Performers</CardTitle>
                      <CardDescription>
                        Models ranked by average accuracy across all completed
                        benchmarks
                      </CardDescription>
                    </div>
                    <div className="rounded-lg bg-chart-4/10 p-2 text-chart-4">
                      <Medal className="h-5 w-5" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {resultsData.globalLeaderboard
                      .slice(0, 10)
                      .map((entry, index) => (
                        <div
                          key={entry.model}
                          className="flex items-center gap-4 rounded-lg border border-border/50 bg-muted/30 p-3"
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                              index === 0
                                ? "bg-chart-4/20 text-chart-4"
                                : index === 1
                                  ? "bg-muted-foreground/20 text-muted-foreground"
                                  : index === 2
                                    ? "bg-chart-5/20 text-chart-5"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {entry.model}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.suitesParticipated} suite
                              {entry.suitesParticipated !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-primary">
                              {entry.averageScore.toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              avg accuracy
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completed Suites Grid */}
            <div>
              <h2 className="text-xl font-semibold mb-2">Results by Suite</h2>
              <p className="text-muted-foreground mb-4">
                View detailed results for each completed benchmark suite.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resultsData.suiteRuns.map((run) => (
                  <Card
                    key={run.suiteId}
                    className="flex flex-col border-primary/30 bg-primary/5 transition-all hover:border-primary/50"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg">
                            {run.suiteName}
                          </CardTitle>
                        </div>
                        <ChainBadge chain={run.chain} size="sm" />
                      </div>
                      <CardDescription className="line-clamp-2">
                        {run.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3">
                      {/* Top Performer Preview */}
                      {run.topPerformer && (
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-xs text-muted-foreground mb-1">
                            Top Performer
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">
                              {run.topPerformer.model}
                            </span>
                            <span className="font-mono font-bold text-primary">
                              {run.topPerformer.score.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Quick Stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {run.totalModels} models
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(run.timestamp)}
                        </span>
                      </div>

                      <Button asChild className="w-full mt-auto">
                        <Link href={`/suite/${run.suiteId}`}>
                          View Full Results
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">No Results Yet</h2>
            <p className="text-muted-foreground mb-4">
              No benchmarks have been completed yet. Fund a benchmark suite to
              trigger testing.
            </p>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Funding
              </Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
