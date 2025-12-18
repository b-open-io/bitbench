"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Trophy,
  Calendar,
  Layers,
  Cpu,
  ArrowUpDown,
  Search,
  Beaker,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
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

interface LeaderboardEntry {
  model: string;
  averageScore: number;
  suitesParticipated: number;
  totalCost: number;
}

interface RankedEntry extends LeaderboardEntry {
  originalRank: number;
}

interface AggregatedResults {
  totalCompletedSuites: number;
  totalModelsEvaluated: number;
  totalTestsExecuted: number;
  latestRun: SuiteRunSummary | null;
  suiteRuns: SuiteRunSummary[];
  globalLeaderboard: LeaderboardEntry[];
}

type SortKey = "rank" | "model" | "score" | "cost";
type SortDir = "asc" | "desc";

function formatCost(val: number): string {
  if (val < 0.01) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(2)}`;
}

// Stat card with icon
function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold font-mono">{value}</p>
      </div>
    </div>
  );
}

// Rank badge with trophy for top 3
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="h-5 w-5" style={{ color: "var(--chart-4)" }} />;
  }
  if (rank === 2) {
    return <Trophy className="h-4 w-4 text-muted-foreground" />;
  }
  if (rank === 3) {
    return <Trophy className="h-4 w-4" style={{ color: "var(--chart-3)" }} />;
  }
  return <span className="font-mono text-sm text-muted-foreground">#{rank}</span>;
}

// Custom chart tooltip
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { name: string } }> }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg border bg-popover p-2 shadow-md text-popover-foreground text-xs">
      <span className="font-bold">{payload[0].payload.name}</span>
      <div className="mt-1 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--primary)" }}
        />
        <span>{Number(payload[0].value).toFixed(2)}%</span>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const [resultsData, setResultsData] = useState<AggregatedResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchTerm, setSearchTerm] = useState("");

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

  // Process leaderboard: assign static ranks, filter, then sort
  const processedLeaderboard = useMemo(() => {
    if (!resultsData) return [];

    // First, assign original rank based on score (descending)
    const rankedList: RankedEntry[] = [...resultsData.globalLeaderboard]
      .sort((a, b) => b.averageScore - a.averageScore)
      .map((item, index) => ({ ...item, originalRank: index + 1 }));

    // Filter by search term
    const filtered = rankedList.filter((item) =>
      item.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort by user preference
    return filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "model":
          cmp = a.model.localeCompare(b.model);
          break;
        case "score":
          cmp = a.averageScore - b.averageScore;
          break;
        case "cost":
          cmp = a.totalCost - b.totalCost;
          break;
        case "rank":
        default:
          cmp = a.originalRank - b.originalRank;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [resultsData, sortKey, sortDir, searchTerm]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default sort direction per column type
      setSortDir(key === "model" ? "asc" : key === "cost" ? "asc" : "asc");
    }
  };

  // Chart data - top 10 performers (always by score)
  const chartData = useMemo(() => {
    if (!resultsData) return [];
    return [...resultsData.globalLeaderboard]
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10)
      .map((m) => ({
        name: m.model,
        score: m.averageScore,
      }));
  }, [resultsData]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!resultsData || resultsData.totalCompletedSuites === 0) {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <SiteHeader modelCount={44} />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Funding
          </Link>
          <div className="rounded-lg border border-border bg-muted/30 p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">No Results Yet</h2>
            <p className="text-muted-foreground mb-4">
              No benchmarks have been completed yet. Fund a benchmark suite to trigger testing.
            </p>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Funding
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader modelCount={resultsData.totalModelsEvaluated} />

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Header with stats */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Benchmark Results</h1>
          </div>

          {/* Stat ribbon */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={Layers}
              label="Suites"
              value={resultsData.totalCompletedSuites}
            />
            <StatCard
              icon={Cpu}
              label="Models"
              value={resultsData.totalModelsEvaluated}
            />
            <StatCard
              icon={Beaker}
              label="Tests"
              value={resultsData.totalTestsExecuted.toLocaleString()}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT: Leaderboard table (8 cols) */}
          <div className="lg:col-span-8">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Global Leaderboard</CardTitle>
                    <CardDescription>
                      {resultsData.totalModelsEvaluated} models ranked by accuracy
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter models..."
                      className="pl-8 h-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[550px] rounded-b-lg border-t">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead
                          className="w-[70px] cursor-pointer hover:text-foreground"
                          onClick={() => handleSort("rank")}
                        >
                          <div className="flex items-center gap-1">
                            Rank <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:text-foreground"
                          onClick={() => handleSort("model")}
                        >
                          <div className="flex items-center gap-1">
                            Model <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="w-[200px] cursor-pointer hover:text-foreground"
                          onClick={() => handleSort("score")}
                        >
                          <div className="flex items-center gap-1">
                            Accuracy <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="w-[90px] text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort("cost")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Cost <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedLeaderboard.map((entry) => (
                        <TableRow key={entry.model} className="hover:bg-muted/50">
                          <TableCell>
                            <RankBadge rank={entry.originalRank} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {entry.model}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-xs font-bold">
                                {entry.averageScore.toFixed(1)}%
                              </span>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${entry.averageScore}%`,
                                    backgroundColor:
                                      entry.originalRank === 1
                                        ? "var(--chart-4)"
                                        : "var(--primary)",
                                  }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {formatCost(entry.totalCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {processedLeaderboard.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No models found matching "{searchTerm}"
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Chart + Suites (4 cols) */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            {/* Top Performers Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 10 Performers</CardTitle>
                <CardDescription className="text-xs">Highest average accuracy</CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        horizontal={false}
                        stroke="var(--border)"
                        strokeDasharray="4 4"
                      />
                      <XAxis type="number" hide domain={[0, 100]} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={100}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)" }}
                        content={<ChartTooltip />}
                      />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
                        {chartData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? "var(--chart-4)" : "var(--primary)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Suites */}
            <Card className="flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Completed Suites</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[240px]">
                  <div className="space-y-1 p-4 pt-0">
                    {resultsData.suiteRuns.map((run) => (
                      <Link
                        key={run.suiteId}
                        href={`/suite/${run.suiteId}`}
                        className="group block rounded-lg border p-3 transition-colors hover:bg-muted/50 hover:border-primary/50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm group-hover:text-primary transition-colors">
                            {run.suiteName}
                          </span>
                          <ChainBadge chain={run.chain} size="sm" />
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(run.timestamp).toLocaleDateString()}
                            </span>
                          </div>

                          {run.topPerformer && (
                            <div className="flex items-center gap-1">
                              <Trophy
                                className="h-3 w-3"
                                style={{ color: "var(--chart-4)" }}
                              />
                              <span className="truncate max-w-[100px]">
                                {run.topPerformer.model}
                              </span>
                              <span className="font-bold text-foreground">
                                {run.topPerformer.score.toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
