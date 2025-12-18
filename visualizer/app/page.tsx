"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  BarChart3,
  Trophy,
  ArrowRight,
  Loader2,
  Clock,
  Target,
  DollarSign,
  Medal,
} from "lucide-react";
import benchmarkData from "../data/benchmark-results.json";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { FundingStats } from "@/components/funding-stats";
import { SuiteGrid } from "@/components/suite-grid";
import { DonationModal } from "@/components/donation-modal";
import { ChainBadge } from "@/components/chain-badge";
import type { SuiteWithBalance } from "@/lib/types";

interface ModelData {
  model: string;
  correct: number;
  incorrect: number;
  errors: number;
  totalTests: number;
  successRate: number;
  errorRate: number;
  averageDuration: number;
  totalCost: number;
  averageCostPerTest: number;
}

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

function BenchmarkVisualizerContent() {
  const { rankings, metadata } = benchmarkData as {
    rankings: ModelData[];
    metadata: any;
  };

  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "fund";

  const [suites, setSuites] = useState<SuiteWithBalance[]>([]);
  const [suitesLoading, setSuitesLoading] = useState(true);
  const [resultsData, setResultsData] = useState<AggregatedResults | null>(
    null
  );
  const [resultsLoading, setResultsLoading] = useState(true);
  const [selectedSuite, setSelectedSuite] = useState<SuiteWithBalance | null>(
    null
  );
  const [donationModalOpen, setDonationModalOpen] = useState(false);

  const modelCount = metadata?.totalModels ?? rankings.length;

  const completedSuites = useMemo(
    () => suites.filter((s) => s.status === "completed"),
    [suites]
  );

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "fund") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.push(query ? `/?${query}` : "/", { scroll: false });
  };

  // Fetch suites on mount
  useEffect(() => {
    async function fetchSuites() {
      try {
        const res = await fetch("/api/suites");
        if (res.ok) {
          const data = await res.json();
          setSuites(data.suites);
        }
      } catch (error) {
        console.error("Failed to fetch suites:", error);
      } finally {
        setSuitesLoading(false);
      }
    }
    fetchSuites();
  }, []);

  // Fetch aggregated results when results tab is active
  useEffect(() => {
    if (currentTab !== "results") return;

    async function fetchResults() {
      setResultsLoading(true);
      try {
        const res = await fetch("/api/results");
        if (res.ok) {
          const data = await res.json();
          setResultsData(data);
        }
      } catch (error) {
        console.error("Failed to fetch results:", error);
      } finally {
        setResultsLoading(false);
      }
    }
    fetchResults();
  }, [currentTab]);

  const handleDonate = (suite: SuiteWithBalance) => {
    setSelectedSuite(suite);
    setDonationModalOpen(true);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Subtle gradient background using primary color */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(from_var(--primary)_l_c_h/0.12),transparent)]" />

      <SiteHeader modelCount={modelCount} />

      <main className="relative mx-auto max-w-7xl px-4 py-8">
        <Tabs
          value={currentTab}
          onValueChange={handleTabChange}
          className="space-y-8"
        >
          {/* Main navigation tabs */}
          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-card/50 p-2 backdrop-blur-sm md:flex-row">
            <TabsList className="h-10 w-full bg-muted/50 p-1 text-muted-foreground md:w-auto">
              <TabsTrigger
                value="fund"
                className="flex items-center gap-2 rounded-lg px-4 text-sm transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                <Wallet className="h-4 w-4" /> Fund Benchmarks
              </TabsTrigger>
              <TabsTrigger
                value="results"
                className="flex items-center gap-2 rounded-lg px-4 text-sm transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                <BarChart3 className="h-4 w-4" /> View Results
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Fund Benchmarks Tab */}
          <TabsContent
            value="fund"
            className="animate-in fade-in-50 duration-300"
          >
            <FundingStats suites={suites} modelCount={modelCount} />

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Benchmark Test Suites</h2>
              <p className="text-muted-foreground">
                Fund a benchmark suite to trigger a new round of testing across
                all models.
              </p>

              <SuiteGrid
                suites={suites}
                loading={suitesLoading}
                onDonate={handleDonate}
              />
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent
            value="results"
            className="animate-in fade-in-50 duration-300"
          >
            {resultsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : resultsData && resultsData.totalCompletedSuites > 0 ? (
              <div className="space-y-8">
                {/* Hero Stats */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardDescription>Completed Benchmarks</CardDescription>
                        <div className="rounded-lg bg-green-500/10 p-2 text-green-500">
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
                          <CardTitle className="text-xl">
                            Top Performers
                          </CardTitle>
                          <CardDescription>
                            Models ranked by average accuracy across all
                            completed benchmarks
                          </CardDescription>
                        </div>
                        <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                          <Medal className="h-5 w-5" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {resultsData.globalLeaderboard
                          .slice(0, 5)
                          .map((entry, index) => (
                            <div
                              key={entry.model}
                              className="flex items-center gap-4 rounded-lg border border-border/50 bg-muted/30 p-3"
                            >
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                                  index === 0
                                    ? "bg-amber-500/20 text-amber-500"
                                    : index === 1
                                      ? "bg-zinc-400/20 text-zinc-400"
                                      : index === 2
                                        ? "bg-amber-700/20 text-amber-700"
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
                  <h2 className="text-xl font-semibold mb-2">
                    Benchmark Results by Suite
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    View detailed results for each completed benchmark suite.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {resultsData.suiteRuns.map((run) => (
                      <Card
                        key={run.suiteId}
                        className="flex flex-col border-green-500/30 bg-green-500/5 transition-all hover:border-green-500/50"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-500 ring-1 ring-inset ring-green-500/20">
                                  <Trophy className="h-3 w-3" />
                                  Results Ready
                                </span>
                              </div>
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
                                <span className="font-mono font-bold text-green-500">
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
            ) : completedSuites.length > 0 ? (
              // Fallback to simple grid if API returns empty but we have completed suites
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Benchmark Results</h2>
                  <p className="text-muted-foreground">
                    View detailed results for each completed benchmark suite.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {completedSuites.map((suite) => (
                    <Card
                      key={suite.id}
                      className="flex flex-col border-green-500/30 bg-green-500/5"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-500 ring-1 ring-inset ring-green-500/20">
                                <Trophy className="h-3 w-3" />
                                Results Ready
                              </span>
                            </div>
                            <CardTitle className="text-lg">
                              {suite.name}
                            </CardTitle>
                          </div>
                          <ChainBadge chain={suite.chain} size="sm" />
                        </div>
                        <CardDescription className="line-clamp-2">
                          {suite.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col justify-end">
                        <Button asChild className="w-full mt-4">
                          <Link href={`/suite/${suite.id}`}>
                            View Results
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-12 text-center">
                <h2 className="text-xl font-semibold mb-2">No Results Yet</h2>
                <p className="text-muted-foreground mb-4">
                  No benchmarks have been completed yet. Fund a benchmark suite
                  to trigger testing.
                </p>
                <Button onClick={() => handleTabChange("fund")}>
                  View Benchmark Suites
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Donation Modal */}
      <DonationModal
        suite={selectedSuite}
        open={donationModalOpen}
        onClose={() => {
          setDonationModalOpen(false);
          setSelectedSuite(null);
        }}
      />
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(from_var(--primary)_l_c_h/0.12),transparent)]" />
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export default function BenchmarkVisualizer() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BenchmarkVisualizerContent />
    </Suspense>
  );
}
