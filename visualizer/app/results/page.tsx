"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Trophy,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
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
import { Badge } from "@/components/ui/badge";
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

function formatCost(val: number): string {
  if (val < 0.01) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(2)}`;
}

// Custom tooltip for chart
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover p-2 text-popover-foreground shadow-md">
      <p className="font-medium text-sm">{data.model}</p>
      <p className="text-xs text-muted-foreground">
        Score: <span className="font-mono text-foreground">{data.averageScore.toFixed(1)}%</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Cost: <span className="font-mono text-foreground">{formatCost(data.totalCost)}</span>
      </p>
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

  // Chart data - top 10 for bar chart
  const chartData = useMemo(() => {
    if (!resultsData) return [];
    return resultsData.globalLeaderboard
      .slice(0, 10)
      .map((m) => ({
        model: m.model.length > 12 ? m.model.slice(0, 12) + "…" : m.model,
        fullModel: m.model,
        averageScore: m.averageScore,
        totalCost: m.totalCost,
      }));
  }, [resultsData]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

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
    <div className="relative min-h-screen bg-background text-foreground">
      <SiteHeader modelCount={44} />

      <main className="mx-auto max-w-7xl px-4 py-4">
        {/* Compact Header with Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <h1 className="text-xl font-bold tracking-tight">Benchmark Results</h1>
          </div>

          {/* Inline Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Suites:</span>
              <span className="font-mono font-medium">{resultsData.totalCompletedSuites}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Models:</span>
              <span className="font-mono font-medium">{resultsData.totalModelsEvaluated}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Tests:</span>
              <span className="font-mono font-medium">{resultsData.totalTestsExecuted.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: Leaderboard Table */}
          <Card className="lg:col-span-8 flex flex-col overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base font-semibold">Global Leaderboard</CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">
                    {processedLeaderboard.length} models
                  </Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter..."
                    className="pl-8 h-8 w-40"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>

            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead
                      className="w-12 text-center cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("rank")}
                    >
                      <span className="inline-flex items-center gap-1">
                        # <SortIcon column="rank" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("model")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Model <SortIcon column="model" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="w-[280px] cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("score")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Accuracy <SortIcon column="score" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("cost")}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Cost <SortIcon column="cost" />
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedLeaderboard.map((entry) => (
                    <TableRow key={entry.model} className="h-10 hover:bg-muted/50">
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {entry.originalRank}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{entry.model}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs w-12 text-right">
                            {entry.averageScore.toFixed(1)}%
                          </span>
                          <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${entry.averageScore}%` }}
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
          </Card>

          {/* RIGHT: Chart + Recent Suites */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Bar Chart */}
            <Card className="flex-1">
              <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Top 10 Models</CardTitle>
                </div>
                <CardDescription className="text-xs">Accuracy comparison</CardDescription>
              </CardHeader>
              <CardContent className="p-2 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      type="category"
                      dataKey="model"
                      width={90}
                      tick={{ fontSize: 9 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="averageScore" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={index === 0 ? "hsl(var(--chart-4))" : "hsl(var(--primary))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Suites */}
            <Card>
              <CardHeader className="py-3 px-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Completed Suites</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {resultsData.suiteRuns.map((run) => (
                    <Link
                      key={run.suiteId}
                      href={`/suite/${run.suiteId}`}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{run.suiteName}</span>
                          <ChainBadge chain={run.chain} size="sm" />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {run.topPerformer && (
                            <span>
                              Top: {run.topPerformer.model} ({run.topPerformer.score.toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">{formatRelativeTime(run.timestamp)}</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
