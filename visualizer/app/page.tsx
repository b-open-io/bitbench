"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Loader2, Trophy, BarChart3, Target } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { FundingStats } from "@/components/funding-stats";
import { SuiteGrid } from "@/components/suite-grid";
import { DonationModal } from "@/components/donation-modal";
import { SponsorSection } from "@/components/sponsor-section";
import type { SuiteWithBalance, Chain } from "@/lib/types";
import { CHAIN_INFO } from "@/lib/types";

interface ResultsSummary {
  totalCompletedSuites: number;
  totalModelsEvaluated: number;
  topPerformer: { model: string; score: number } | null;
}

function BenchmarkVisualizerContent() {
  const [suites, setSuites] = useState<SuiteWithBalance[]>([]);
  const [suitesLoading, setSuitesLoading] = useState(true);
  const [resultsSummary, setResultsSummary] = useState<ResultsSummary | null>(
    null
  );
  const [selectedSuite, setSelectedSuite] = useState<SuiteWithBalance | null>(
    null
  );
  const [donationModalOpen, setDonationModalOpen] = useState(false);
  const [chainFilter, setChainFilter] = useState<Chain | "all">("all");

  const modelCount = 44; // Could fetch this dynamically

  const filteredSuites = useMemo(
    () =>
      chainFilter === "all"
        ? suites
        : suites.filter((s) => s.chain === chainFilter),
    [suites, chainFilter]
  );

  // Get unique chains from suites for filter options
  const availableChains = useMemo(() => {
    const chains = new Set(suites.map((s) => s.chain));
    return Array.from(chains).sort() as Chain[];
  }, [suites]);

  const completedSuitesCount = useMemo(
    () => suites.filter((s) => s.status === "completed" || s.lastRunAt).length,
    [suites]
  );

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

  // Fetch results summary for the stats banner
  useEffect(() => {
    async function fetchResultsSummary() {
      try {
        const res = await fetch("/api/results");
        if (res.ok) {
          const data = await res.json();
          setResultsSummary({
            totalCompletedSuites: data.totalCompletedSuites,
            totalModelsEvaluated: data.totalModelsEvaluated,
            topPerformer: data.globalLeaderboard?.[0]
              ? {
                  model: data.globalLeaderboard[0].model,
                  score: data.globalLeaderboard[0].averageScore,
                }
              : null,
          });
        }
      } catch (error) {
        console.error("Failed to fetch results:", error);
      }
    }
    fetchResultsSummary();
  }, []);

  const handleDonate = (suite: SuiteWithBalance) => {
    setSelectedSuite(suite);
    setDonationModalOpen(true);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Subtle gradient background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(from_var(--primary)_l_c_h/0.12),transparent)]" />

      <SiteHeader modelCount={modelCount} />

      <main className="relative mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Overall Stats */}
        <FundingStats suites={suites} modelCount={modelCount} />

        {/* Results Summary Banner (if there are completed benchmarks) */}
        {resultsSummary && resultsSummary.totalCompletedSuites > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-chart-4" />
                  <CardDescription className="text-foreground font-medium">
                    {resultsSummary.totalCompletedSuites} Benchmark
                    {resultsSummary.totalCompletedSuites !== 1 ? "s" : ""}{" "}
                    Completed
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/results">View All Results</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {resultsSummary.totalModelsEvaluated} models tested
                  </span>
                </div>
                {resultsSummary.topPerformer && (
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Top performer:{" "}
                      <span className="text-foreground font-medium">
                        {resultsSummary.topPerformer.model}
                      </span>{" "}
                      ({resultsSummary.topPerformer.score.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suite Grid Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Benchmark Test Suites</h2>
              <p className="text-muted-foreground">
                Fund a benchmark to test {modelCount}+ AI models. Results
                publish automatically when funded.
              </p>
            </div>

            {/* Chain Filter */}
            {availableChains.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setChainFilter("all")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    chainFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  All
                </button>
                {availableChains.map((chain) => {
                  const info = CHAIN_INFO[chain];
                  const isActive = chainFilter === chain;
                  return (
                    <button
                      key={chain}
                      onClick={() => setChainFilter(chain)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? `${info.bgColor} ${info.color} ring-1 ring-inset ring-current`
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {info.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <SuiteGrid
            suites={filteredSuites}
            loading={suitesLoading}
            onDonate={handleDonate}
          />
        </div>
      </main>

      {/* Sponsor Section */}
      <SponsorSection />

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
