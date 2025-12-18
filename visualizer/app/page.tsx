"use client";

import { useState, useEffect } from "react";
import { Wallet, BarChart3 } from "lucide-react";
import benchmarkData from "../data/benchmark-results.json";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHeader } from "@/components/site-header";
import { FundingStats } from "@/components/funding-stats";
import { SuiteGrid } from "@/components/suite-grid";
import { BenchmarkCharts } from "@/components/benchmark-charts";
import { DonationModal } from "@/components/donation-modal";
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

export default function BenchmarkVisualizer() {
  const { rankings, metadata } = benchmarkData as {
    rankings: ModelData[];
    metadata: any;
  };

  const [suites, setSuites] = useState<SuiteWithBalance[]>([]);
  const [suitesLoading, setSuitesLoading] = useState(true);
  const [selectedSuite, setSelectedSuite] = useState<SuiteWithBalance | null>(
    null
  );
  const [donationModalOpen, setDonationModalOpen] = useState(false);

  const modelCount = metadata?.totalModels ?? rankings.length;

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
        <Tabs defaultValue="fund" className="space-y-8">
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
            <BenchmarkCharts rankings={rankings} />
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
