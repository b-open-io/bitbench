"use client"

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Search,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { ChainBadge } from "@/components/chain-badge"
import { PageContainer } from "@/components/page-container"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChartConfig } from "@/components/ui/chart"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type Chain, CHAIN_INFO, isChain } from "@/lib/types"

type MetricKind = "accuracy" | "leaning"

interface SuiteRunSummary {
  suiteId: string
  suiteName: string
  chain: Chain
  description: string
  timestamp: string
  version: string
  totalModels: number
  totalTests: number
  metricKind: MetricKind
  topPerformer: {
    model: string
    score: number
    leaning?: number
  } | null
  totalCost: number
}

interface IndexEntry {
  model: string
  averageScore: number
  suitesParticipated: number
  totalCost: number
}

interface NamedIndex {
  id: string
  name: string
  description: string
  metricLabel: string
  metricKind: MetricKind
  requiredSuiteIds: string[]
  models: IndexEntry[]
}

interface RankedEntry extends IndexEntry {
  originalRank: number
}

interface AggregatedResults {
  totalCompletedSuites: number
  totalModelsEvaluated: number
  totalTestsExecuted: number
  latestRun: SuiteRunSummary | null
  suiteRuns: SuiteRunSummary[]
  knowledgeIndex: NamedIndex
  globalLeaderboard: IndexEntry[]
}

type SortKey = "rank" | "model" | "score" | "cost"
type SortDir = "asc" | "desc"
type SuiteFilter = "all" | "knowledge" | "ai" | Chain

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object`)
  }
  return value
}

function readString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = record[key]
  if (typeof value !== "string") {
    throw new Error(`${context}.${key} must be a string`)
  }
  return value
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = record[key]
  if (typeof value !== "number") {
    throw new Error(`${context}.${key} must be a number`)
  }
  return value
}

function readArray(
  record: Record<string, unknown>,
  key: string,
  context: string,
): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`${context}.${key} must be an array`)
  }
  return value
}

function parseMetricKind(value: unknown, context: string): MetricKind {
  if (value === "accuracy" || value === "leaning") return value
  // Older payloads without metricKind: treat as accuracy (knowledge-only era)
  if (value === undefined) return "accuracy"
  throw new Error(`${context} has unknown metricKind "${String(value)}"`)
}

function parseTopPerformer(
  value: unknown,
  context: string,
): SuiteRunSummary["topPerformer"] {
  if (value === null) return null
  const record = readRecord(value, context)
  const leaning = record.leaning
  return {
    model: readString(record, "model", context),
    score: readNumber(record, "score", context),
    ...(typeof leaning === "number" ? { leaning } : {}),
  }
}

function parseSuiteRunSummary(
  value: unknown,
  context: string,
): SuiteRunSummary {
  const record = readRecord(value, context)
  const chain = record.chain
  if (!isChain(chain)) {
    throw new Error(`${context}.chain has unknown value "${String(chain)}"`)
  }

  return {
    suiteId: readString(record, "suiteId", context),
    suiteName: readString(record, "suiteName", context),
    chain,
    description: readString(record, "description", context),
    timestamp: readString(record, "timestamp", context),
    version: readString(record, "version", context),
    totalModels: readNumber(record, "totalModels", context),
    totalTests: readNumber(record, "totalTests", context),
    metricKind: parseMetricKind(record.metricKind, `${context}.metricKind`),
    topPerformer: parseTopPerformer(
      record.topPerformer,
      `${context}.topPerformer`,
    ),
    totalCost: readNumber(record, "totalCost", context),
  }
}

function parseIndexEntry(value: unknown, context: string): IndexEntry {
  const record = readRecord(value, context)
  return {
    model: readString(record, "model", context),
    averageScore: readNumber(record, "averageScore", context),
    suitesParticipated: readNumber(record, "suitesParticipated", context),
    totalCost: readNumber(record, "totalCost", context),
  }
}

function parseNamedIndex(value: unknown, context: string): NamedIndex {
  const record = readRecord(value, context)
  return {
    id: readString(record, "id", context),
    name: readString(record, "name", context),
    description: readString(record, "description", context),
    metricLabel: readString(record, "metricLabel", context),
    metricKind: parseMetricKind(record.metricKind, `${context}.metricKind`),
    requiredSuiteIds: readArray(record, "requiredSuiteIds", context).map(
      (id, i) => {
        if (typeof id !== "string") {
          throw new Error(`${context}.requiredSuiteIds[${i}] must be a string`)
        }
        return id
      },
    ),
    models: readArray(record, "models", context).map((entry, index) =>
      parseIndexEntry(entry, `${context}.models[${index}]`),
    ),
  }
}

function parseAggregatedResults(value: unknown): AggregatedResults {
  const record = readRecord(value, "results")
  const latestRun =
    record.latestRun === null
      ? null
      : parseSuiteRunSummary(record.latestRun, "results.latestRun")

  // Prefer knowledgeIndex; fall back to wrapping globalLeaderboard for older deploys
  let knowledgeIndex: NamedIndex
  if (record.knowledgeIndex !== undefined) {
    knowledgeIndex = parseNamedIndex(
      record.knowledgeIndex,
      "results.knowledgeIndex",
    )
  } else {
    const models = readArray(record, "globalLeaderboard", "results").map(
      (entry, index) =>
        parseIndexEntry(entry, `results.globalLeaderboard[${index}]`),
    )
    knowledgeIndex = {
      id: "bitcoin-knowledge",
      name: "Bitcoin Knowledge Index",
      description:
        "Legacy payload without knowledgeIndex field — treating board as knowledge-only.",
      metricLabel: "Accuracy (%)",
      metricKind: "accuracy",
      requiredSuiteIds: [],
      models,
    }
  }

  return {
    totalCompletedSuites: readNumber(record, "totalCompletedSuites", "results"),
    totalModelsEvaluated: readNumber(record, "totalModelsEvaluated", "results"),
    totalTestsExecuted: readNumber(record, "totalTestsExecuted", "results"),
    latestRun,
    suiteRuns: readArray(record, "suiteRuns", "results").map((run, index) =>
      parseSuiteRunSummary(run, `results.suiteRuns[${index}]`),
    ),
    knowledgeIndex,
    globalLeaderboard: knowledgeIndex.models,
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatCost(val: number): string {
  if (val < 0.01) return `$${val.toFixed(4)}`
  return `$${val.toFixed(2)}`
}

function formatTopMetric(run: SuiteRunSummary): string {
  const top = run.topPerformer
  if (!top) return "No rankings"
  if (run.metricKind === "leaning") {
    const lean =
      top.leaning !== undefined
        ? top.leaning
        : (2 * top.score) / 100 - 1
    const sign = lean > 0 ? "+" : ""
    return `${top.model} · leaning ${sign}${lean.toFixed(2)}`
  }
  return `${top.model} · ${top.score.toFixed(0)}% accuracy`
}

function metricBadgeLabel(kind: MetricKind): string {
  return kind === "leaning" ? "Leaning" : "Accuracy"
}

export default function ResultsPage() {
  const [resultsData, setResultsData] = useState<AggregatedResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("rank")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [searchTerm, setSearchTerm] = useState("")
  const [suiteFilter, setSuiteFilter] = useState<SuiteFilter>("all")
  const modelCount = resultsData?.totalModelsEvaluated ?? 0

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch("/api/results")
        if (res.ok) {
          const data: unknown = await res.json()
          setResultsData(parseAggregatedResults(data))
        }
      } catch (error) {
        console.error("Failed to fetch results:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [])

  const knowledgeModels = resultsData?.knowledgeIndex.models ?? []

  const processedLeaderboard = useMemo(() => {
    const rankedList: RankedEntry[] = [...knowledgeModels]
      .sort((a, b) => b.averageScore - a.averageScore)
      .map((item, index) => ({ ...item, originalRank: index + 1 }))

    const filtered = rankedList.filter((item) =>
      item.model.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    return filtered.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "model":
          cmp = a.model.localeCompare(b.model)
          break
        case "score":
          cmp = a.averageScore - b.averageScore
          break
        case "cost":
          cmp = a.totalCost - b.totalCost
          break
        default:
          cmp = a.originalRank - b.originalRank
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [knowledgeModels, sortKey, sortDir, searchTerm])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "model" ? "asc" : key === "cost" ? "asc" : "asc")
    }
  }

  const barChartData = useMemo(() => {
    const getBaseName = (model: string): string => {
      return model
        .replace(/-thinking-high$/, "")
        .replace(/-thinking$/, "")
        .replace(/-non-thinking$/, "")
    }

    const isThinking = (model: string): boolean => {
      const lower = model.toLowerCase()
      return (
        lower.includes("-thinking") ||
        lower.startsWith("o3") ||
        lower.startsWith("o4")
      )
    }

    const groups = new Map<string, { standard: number; thinkingRaw: number }>()

    for (const m of knowledgeModels) {
      const base = getBaseName(m.model)
      if (!groups.has(base)) {
        groups.set(base, { standard: 0, thinkingRaw: 0 })
      }
      const group = groups.get(base)
      if (!group) {
        throw new Error(`Missing leaderboard group for ${base}`)
      }
      if (isThinking(m.model)) {
        group.thinkingRaw = m.averageScore
      } else {
        group.standard = m.averageScore
      }
    }

    return Array.from(groups.entries())
      .map(([model, scores]) => {
        const hasStandard = scores.standard > 0
        const hasThinking = scores.thinkingRaw > 0

        if (hasStandard && hasThinking) {
          return {
            model,
            standard: scores.standard,
            thinking: Math.max(0, scores.thinkingRaw - scores.standard),
            thinkingActual: scores.thinkingRaw,
          }
        }
        return {
          model,
          standard: hasStandard ? scores.standard : scores.thinkingRaw,
          thinking: 0,
          thinkingActual: hasThinking ? scores.thinkingRaw : 0,
        }
      })
      .sort((a, b) => b.standard + b.thinking - (a.standard + a.thinking))
  }, [knowledgeModels])

  const filteredSuiteRuns = useMemo(() => {
    if (!resultsData) return []
    return resultsData.suiteRuns.filter((run) => {
      if (suiteFilter === "all") return true
      if (suiteFilter === "knowledge") return run.chain !== "ai"
      if (suiteFilter === "ai") return run.chain === "ai"
      return run.chain === suiteFilter
    })
  }, [resultsData, suiteFilter])

  const chartConfig = {
    standard: {
      label: "Standard",
      color: "var(--chart-1)",
    },
    thinking: {
      label: "Thinking",
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    )
  }

  if (loading) {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <SiteHeader modelCount={modelCount} />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!resultsData || resultsData.totalCompletedSuites === 0) {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <SiteHeader modelCount={modelCount} />
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
        </main>
      </div>
    )
  }

  const index = resultsData.knowledgeIndex
  const suiteFilterOptions: { id: SuiteFilter; label: string }[] = [
    { id: "all", label: "All suites" },
    { id: "knowledge", label: "Knowledge" },
    { id: "ai", label: "AI values" },
    ...(["bsv", "btc", "eth", "sol", "bch", "ltc"] as Chain[])
      .filter((c) => resultsData.suiteRuns.some((r) => r.chain === c))
      .map((c) => ({ id: c as SuiteFilter, label: CHAIN_INFO[c].name })),
  ]

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <SiteHeader modelCount={modelCount} />

      <PageContainer forceWidth="full" className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <h1 className="text-xl font-bold tracking-tight">
              Benchmark Results
            </h1>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Suites:</span>
              <span className="font-mono font-medium">
                {resultsData.totalCompletedSuites}
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Models:</span>
              <span className="font-mono font-medium">
                {resultsData.totalModelsEvaluated}
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Tests:</span>
              <span className="font-mono font-medium">
                {resultsData.totalTestsExecuted.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
          Scores are not interchangeable. Knowledge suites report accuracy;
          philosophy suites report leaning on a −1…+1 axis. Only knowledge
          suites feed the named index below — AI values never mix into that
          average.
        </p>

        {knowledgeModels.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{index.name}</CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">
                    {index.metricLabel}
                  </Badge>
                </div>
                <Badge variant="outline" className="text-xs font-normal w-fit">
                  {barChartData.length} models · {index.requiredSuiteIds.length}{" "}
                  suites
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
                {index.description}
              </p>
            </CardHeader>
            <CardContent className="px-2 sm:p-6">
              <div className="overflow-x-auto">
                <div
                  style={{
                    height: 340,
                    minWidth: `${Math.max(barChartData.length * 34, 480)}px`,
                  }}
                >
                  <ChartContainer
                    config={chartConfig}
                    className="!aspect-auto h-full w-full"
                  >
                    <BarChart
                      accessibilityLayer
                      data={barChartData}
                      margin={{ left: 12, right: 12 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="model"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={90}
                        tick={{ fontSize: 11 }}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            className="w-[200px]"
                            labelFormatter={(_, payload) => {
                              if (payload?.[0]?.payload?.model) {
                                return payload[0].payload.model
                              }
                              return ""
                            }}
                            formatter={(value, name, item) => {
                              const displayValue =
                                name === "thinking"
                                  ? item.payload.thinkingActual
                                  : value
                              if (
                                name === "thinking" &&
                                !item.payload.thinkingActual
                              )
                                return null
                              return (
                                <>
                                  <div
                                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                    style={{ backgroundColor: item.color }}
                                  />
                                  <div className="flex flex-1 items-center justify-between">
                                    <span className="text-muted-foreground">
                                      {name === "standard"
                                        ? "Standard"
                                        : "Thinking"}
                                    </span>
                                    <span className="font-mono font-medium">
                                      {Number(displayValue).toFixed(1)}%
                                    </span>
                                  </div>
                                </>
                              )
                            }}
                          />
                        }
                      />
                      <ChartLegend
                        content={<ChartLegendContent payload={[]} />}
                      />
                      <Bar
                        dataKey="standard"
                        stackId="a"
                        fill="var(--color-standard)"
                        radius={[0, 0, 4, 4]}
                      />
                      <Bar
                        dataKey="thinking"
                        stackId="a"
                        fill="var(--color-thinking)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </PageContainer>

      <PageContainer forceWidth="default" className="pb-16">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="flex flex-col overflow-hidden lg:col-span-2">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <CardTitle className="whitespace-nowrap text-base font-semibold">
                      {index.name}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="whitespace-nowrap text-xs font-normal"
                    >
                      {processedLeaderboard.length} models
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Equal coverage of knowledge suites only · not a global blend
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter..."
                    className="h-8 w-full pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>

            <ScrollArea className="h-[500px]">
              {processedLeaderboard.length === 0 && searchTerm === "" ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No models yet with complete knowledge-suite coverage. Open a
                  suite card for per-benchmark rankings (including AI values).
                </div>
              ) : (
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
                          {index.metricLabel} <SortIcon column="score" />
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
                      <TableRow
                        key={entry.model}
                        className="h-10 hover:bg-muted/50"
                      >
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {entry.originalRank}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {entry.model}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs w-12 text-right">
                              {entry.averageScore.toFixed(1)}%
                            </span>
                            <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{
                                  width: `${Math.min(100, entry.averageScore)}%`,
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
                        <TableCell
                          colSpan={4}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No models found matching &quot;{searchTerm}&quot;
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Suite catalog</CardTitle>
              </div>
              <div className="flex flex-wrap gap-1">
                {suiteFilterOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSuiteFilter(opt.id)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      suiteFilter === opt.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
                {filteredSuiteRuns.map((run) => (
                  <Link
                    key={run.suiteId}
                    href={`/suite/${run.suiteId}`}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {run.suiteName}
                        </span>
                        <ChainBadge chain={run.chain} size="sm" />
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {metricBadgeLabel(run.metricKind)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatTopMetric(run)}
                      </div>
                      <div className="text-[11px] text-muted-foreground/80">
                        v{run.version} · {run.totalModels} models
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                      <span className="text-xs">
                        {formatRelativeTime(run.timestamp)}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                ))}
                {filteredSuiteRuns.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No suites match this filter.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  )
}
