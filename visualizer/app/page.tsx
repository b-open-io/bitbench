"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Wallet, BarChart3, Trophy, ArrowRight, Loader2 } from "lucide-react";
import benchmarkData from "../data/benchmark-results.json";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-8">
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
            {completedSuites.length > 0 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Benchmark Results</h2>
                  <p className="text-muted-foreground">
                    View detailed results for each completed benchmark suite.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {completedSuites.map((suite) => (
                    <Card key={suite.id} className="flex flex-col border-green-500/30 bg-green-500/5">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-500 ring-1 ring-inset ring-green-500/20">
                                <Trophy className="h-3 w-3" />
                                Results Ready
                              </span>
                            </div>
                            <CardTitle className="text-lg">{suite.name}</CardTitle>
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
                  No benchmarks have been completed yet. Fund a benchmark suite to trigger testing.
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
