import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tag, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChainBadge } from "@/components/chain-badge";
import { SuiteSwitcher } from "@/components/suite-switcher";
import { BenchmarkCharts } from "@/components/benchmark-charts";
import { QuestionBreakdownCard } from "@/components/question-breakdown";
import { SiteHeader } from "@/components/site-header";
import { getSuiteWithBalance, getAllSuites } from "@/lib/suites";
import { getLatestRun } from "@/lib/kv";
import type { ModelResult, BenchmarkRun } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Transform ModelResult to the format BenchmarkCharts expects
function transformRankings(rankings: ModelResult[]) {
  return rankings.map((r) => ({
    model: r.model,
    correct: r.correct,
    incorrect: r.total - r.correct,
    errors: 0,
    totalTests: r.total,
    successRate: r.score,
    errorRate: 0,
    averageDuration: r.avgResponseTime,
    totalCost: r.cost,
    averageCostPerTest: r.cost / r.total,
  }));
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const suite = await getSuiteWithBalance(id);

  if (!suite) {
    return { title: "Suite Not Found - Bitbench" };
  }

  return {
    title: `${suite.name} Results - Bitbench`,
    description: suite.description,
  };
}

export default async function SuiteResultsPage({ params }: PageProps) {
  const { id } = await params;

  const [suite, latestRun, allSuites] = await Promise.all([
    getSuiteWithBalance(id),
    getLatestRun(id),
    getAllSuites(),
  ]);

  if (!suite) {
    notFound();
  }

  // Check if we have results
  const hasResults = latestRun && latestRun.rankings && latestRun.rankings.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader modelCount={44} />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ChainBadge chain={suite.chain} />
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    v{suite.version}
                  </span>
                </div>
                <h1 className="text-2xl font-bold">{suite.name}</h1>
                <p className="text-muted-foreground">{suite.description}</p>
              </div>
            </div>
            <SuiteSwitcher currentSuiteId={id} suites={allSuites} />
          </div>

          {/* Run info */}
          {latestRun && (
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Last run: {formatDate(latestRun.timestamp)}
              </span>
              {latestRun.version && (
                <span className="flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  Test version: v{latestRun.version}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        {hasResults ? (
          <div className="space-y-8">
            <BenchmarkCharts rankings={transformRankings(latestRun.rankings)} />
            <QuestionBreakdownCard suiteId={id} />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">No Results Yet</h2>
            <p className="text-muted-foreground mb-4">
              This benchmark hasn&apos;t been run yet. Check back after it&apos;s funded and executed.
            </p>
            <Button asChild>
              <Link href="/">View All Benchmarks</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
