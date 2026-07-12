"use client"

import {
  ChevronDown,
  Clock,
  DollarSign,
  Filter,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { type ReactNode, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"
import type { Props as RechartsLabelProps } from "recharts/types/component/Label"
import type { RenderableText } from "recharts/types/component/Text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PhilosophyLeaningChart } from "@/components/philosophy-leaning-chart"
import { useIsMobile } from "@/hooks/use-mobile"

interface ModelData {
  model: string
  correct: number
  incorrect: number
  errors: number
  totalTests: number
  successRate: number
  errorRate: number
  averageDuration: number
  totalCost: number
  averageCostPerTest: number
  positionRate?: number
  complianceRate?: number
  leaning?: number
}

interface PoleLabels {
  high: string
  low: string
  metric: "leaning" | "score"
}

interface BenchmarkChartsProps {
  rankings: ModelData[]
  chain?: string
  poles?: PoleLabels
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("hsl("))
    return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`)
  if (color.startsWith("rgb("))
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`)
  return color
}

function getGradientId(prefix: string, model: string) {
  return `${prefix}-${model.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
}

function currency(n: number) {
  return `$${n.toFixed(2)}`
}

type PerformancePoint = {
  model: string
  successRate: number
  totalCost: number
  duration: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isPerformancePoint(value: unknown): value is PerformancePoint {
  return (
    isRecord(value) &&
    typeof value.model === "string" &&
    typeof value.successRate === "number" &&
    typeof value.totalCost === "number" &&
    typeof value.duration === "number"
  )
}

function toFiniteNumber(value: number | string | undefined): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function toRenderableNumber(value: RenderableText): number | null {
  if (typeof value === "boolean" || value == null) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function modelTooltipLabel(label: ReactNode): string {
  if (typeof label === "string" || typeof label === "number") {
    return `Model: ${label}`
  }
  return "Model"
}

function barValueLabel(suffix: string, decimals: number) {
  return (props: RechartsLabelProps) => {
    const value = toRenderableNumber(props.value)
    if (value === null) return null

    const x = toFiniteNumber(props.x)
    const y = toFiniteNumber(props.y)
    const width = toFiniteNumber(props.width)
    const cx = x + width / 2
    const cy = y - 6
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        className="pointer-events-none text-xs font-medium fill-muted-foreground"
      >
        {value.toFixed(decimals)}
        {suffix}
      </text>
    )
  }
}

function barValueLabelHorizontalSmart(
  suffix: string,
  decimals: number,
  maxValue: number,
) {
  return (props: RechartsLabelProps) => {
    const value = toRenderableNumber(props.value)
    if (value === null) return null

    const x = toFiniteNumber(props.x)
    const y = toFiniteNumber(props.y)
    const width = toFiniteNumber(props.width)
    const height = toFiniteNumber(props.height)
    const ratio = maxValue > 0 ? value / maxValue : 0
    const inside = ratio >= 0.75
    const tx = inside ? x + width - 6 : x + width + 6
    const anchor: "end" | "start" = inside ? "end" : "start"
    const cls = inside
      ? "pointer-events-none text-[10px] font-medium fill-foreground"
      : "pointer-events-none text-[10px] font-medium fill-muted-foreground"
    return (
      <text
        x={tx}
        y={y + height / 2}
        dy={3}
        textAnchor={anchor}
        className={cls}
      >
        {value.toFixed(decimals)}
        {suffix}
      </text>
    )
  }
}

function truncateLabel(input: unknown, max = 14) {
  const label = String(input ?? "")
  if (label.length <= max) return label
  return `${label.slice(0, Math.max(1, max - 1))}...`
}

export function BenchmarkCharts({
  rankings,
  chain,
  poles,
}: BenchmarkChartsProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>(
    rankings.map((m) => m.model),
  )

  const isMobile = useIsMobile()
  const filteredRankings = rankings.filter((m) =>
    selectedModels.includes(m.model),
  )
  const mobileBarHeight = Math.max(320, filteredRankings.length * 36 + 120)
  // Use the vertical (horizontal-bar) layout on mobile OR whenever there
  // are many models, so x-axis labels never overlap into an unreadable mess.
  const vertical = isMobile || filteredRankings.length > 14
  const totalTestsPerModel = rankings[0]?.totalTests ?? 0

  const isPhilosophy =
    chain === "ai" &&
    poles?.metric === "leaning" &&
    rankings.some((m) => m.leaning !== undefined)

  const successRateData = filteredRankings
    .map((m) => {
      const leaning =
        m.leaning !== undefined ? Number(m.leaning.toFixed(3)) : undefined
      return {
        model: m.model,
        successRate: Number(m.successRate.toFixed(1)),
        correct: m.correct,
        total: m.totalTests,
        leaning,
        // Chart domain 0–2 maps leaning −1…+1 for bar length from low pole
        leaningDisplay: leaning !== undefined ? leaning + 1 : 0,
        positionRate:
          m.positionRate !== undefined
            ? Number(m.positionRate.toFixed(1))
            : undefined,
        complianceRate:
          m.complianceRate !== undefined
            ? Number(m.complianceRate.toFixed(1))
            : undefined,
      }
    })
    .sort((a, b) => {
      if (
        isPhilosophy &&
        a.leaning !== undefined &&
        b.leaning !== undefined
      ) {
        return b.leaning - a.leaning
      }
      return b.successRate - a.successRate
    })

  const costData = filteredRankings
    .map((m) => ({
      model: m.model,
      totalCost: Number(m.totalCost.toFixed(4)),
    }))
    .sort((a, b) => a.totalCost - b.totalCost)

  const speedData = filteredRankings
    .map((m) => ({
      model: m.model,
      duration: Number((m.averageDuration / 1000).toFixed(2)),
      durationMs: m.averageDuration,
    }))
    .sort((a, b) => a.duration - b.duration)

  const performanceData = filteredRankings.map((m) => ({
    model: m.model.replace(/-/g, " "),
    originalModel: m.model,
    successRate: m.successRate,
    totalCost: m.totalCost,
    duration: m.averageDuration / 1000,
  }))

  const getModelColor = (modelName: string) => {
    const colors = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ]
    const index = rankings.findIndex((r) => r.model === modelName)
    return colors[(index + colors.length) % colors.length]
  }

  const handleModelToggle = (modelName: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelName)
        ? prev.filter((m) => m !== modelName)
        : [...prev, modelName],
    )
  }
  const handleSelectAll = () => setSelectedModels(rankings.map((m) => m.model))
  const handleDeselectAll = () => setSelectedModels([])

  const costMax = Math.max(0, ...costData.map((d) => d.totalCost))
  const speedMax = Math.max(0, ...speedData.map((d) => d.duration))

  return (
    <Tabs defaultValue="accuracy" className="space-y-8">
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-card/50 p-2 backdrop-blur-sm md:flex-row">
        <TabsList className="h-10 w-full bg-muted/50 p-1 text-muted-foreground md:w-auto">
          <TabsTrigger
            value="accuracy"
            className="flex items-center gap-2 rounded-lg px-4 text-sm transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <Target className="h-4 w-4" />{" "}
            {isPhilosophy ? "Leaning" : "Accuracy"}
          </TabsTrigger>
          <TabsTrigger
            value="cost"
            className="flex items-center gap-2 rounded-lg px-4 text-sm transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <DollarSign className="h-4 w-4" /> Cost
          </TabsTrigger>
          <TabsTrigger
            value="speed"
            className="flex items-center gap-2 rounded-lg px-4 text-sm transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <Clock className="h-4 w-4" /> Speed
          </TabsTrigger>
          <TabsTrigger
            value="combined"
            className="flex items-center gap-2 rounded-lg px-4 text-sm transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <TrendingUp className="h-4 w-4" /> Combined
          </TabsTrigger>
        </TabsList>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="mr-2 h-4 w-4" /> Models (
              {selectedModels.length}/{rankings.length})
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-96">
            <DropdownMenuLabel>Select models</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex gap-2 p-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectAll}
                className="flex-1"
              >
                Select all
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeselectAll}
                className="flex-1"
              >
                Clear
              </Button>
            </div>
            <DropdownMenuSeparator />
            <ScrollArea className="h-80">
              {rankings.map((m) => (
                <DropdownMenuItem
                  key={m.model}
                  className="group flex items-center gap-3 py-2"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Checkbox
                    id={m.model}
                    checked={selectedModels.includes(m.model)}
                    onCheckedChange={() => handleModelToggle(m.model)}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: getModelColor(m.model) }}
                    />
                    <label
                      htmlFor={m.model}
                      className="cursor-pointer truncate text-sm"
                    >
                      {m.model}
                    </label>
                  </div>
                  <Badge
                    variant="secondary"
                    className="ml-auto font-mono text-xs"
                  >
                    {isPhilosophy && m.leaning !== undefined
                      ? m.leaning.toFixed(2)
                      : `${m.successRate.toFixed(1)}%`}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TabsContent
        value="accuracy"
        className="animate-in fade-in-50 duration-300"
      >
        {isPhilosophy && poles ? (
          <PhilosophyLeaningChart
            models={filteredRankings.map((m) => ({
              model: m.model,
              leaning: m.leaning,
              positionRate: m.positionRate,
              complianceRate: m.complianceRate,
            }))}
            highPole={poles.high}
            lowPole={poles.low}
            positionCellsHint={
              totalTestsPerModel > 0
                ? `${totalTestsPerModel} scored cells per model (roles × runs).`
                : undefined
            }
          />
        ) : (
          <Card className="group relative overflow-hidden transition-all duration-300 hover:border-primary/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-medium">
                    Success Rate by Model
                  </CardTitle>
                  <CardDescription>
                    Percentage of correct answers out of {totalTestsPerModel}{" "}
                    tests per model
                  </CardDescription>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Trophy className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  successRate: {
                    label: "Success Rate",
                    color: "var(--chart-1)",
                  },
                }}
                className="h-[420px] sm:h-[520px] w-full"
                style={vertical ? { height: mobileBarHeight } : undefined}
              >
                <BarChart
                  data={successRateData}
                  layout={vertical ? "vertical" : "horizontal"}
                  margin={
                    vertical
                      ? { top: 10, right: 24, left: 140, bottom: 24 }
                      : { top: 10, right: 24, left: 12, bottom: 64 }
                  }
                >
                  <defs>
                    {successRateData.map((d) => {
                      const base = getModelColor(d.model)
                      const id = getGradientId("sr", d.model)
                      return (
                        <linearGradient
                          key={id}
                          id={id}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={withAlpha(base, 0.95)} />
                          <stop
                            offset="100%"
                            stopColor={withAlpha(base, 0.55)}
                          />
                        </linearGradient>
                      )
                    })}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  {vertical ? (
                    <>
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        label={{
                          value: "Success Rate (%)",
                          position: "insideBottom",
                          offset: -10,
                          className: "fill-muted-foreground",
                        }}
                        className="stroke-muted-foreground"
                      />
                      <YAxis
                        type="category"
                        dataKey="model"
                        width={12}
                        tick={{
                          fontSize: 12,
                          className: "fill-muted-foreground",
                        }}
                        tickFormatter={(v: string) => truncateLabel(v)}
                        className="stroke-muted-foreground"
                      />
                    </>
                  ) : (
                    <>
                      <XAxis
                        dataKey="model"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        fontSize={12}
                        className="stroke-muted-foreground"
                      />
                      <YAxis
                        label={{
                          value: "Success Rate (%)",
                          angle: -90,
                          position: "insideLeft",
                          className: "fill-muted-foreground",
                        }}
                        domain={[0, 100]}
                        className="stroke-muted-foreground"
                      />
                    </>
                  )}
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value: unknown) => [
                      `${value}% Success Rate`,
                    ]}
                    labelFormatter={modelTooltipLabel}
                  />
                  <Bar
                    dataKey="successRate"
                    radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                  >
                    <LabelList
                      dataKey="successRate"
                      position={vertical ? "right" : "top"}
                      content={
                        vertical
                          ? barValueLabelHorizontalSmart("%", 1, 100)
                          : barValueLabel("%", 1)
                      }
                    />
                    {successRateData.map((entry) => (
                      <Cell
                        key={entry.model}
                        fill={`url(#${getGradientId("sr", entry.model)})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="cost" className="animate-in fade-in-50 duration-300">
        <Card className="group relative overflow-hidden transition-all duration-300 hover:border-primary/20">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-medium">
                  Cost Efficiency by Model
                </CardTitle>
                <CardDescription>
                  Total cost to run all tests (lower is better)
                </CardDescription>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                totalCost: {
                  label: "Cost per Test",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[420px] sm:h-[520px] w-full"
              style={vertical ? { height: mobileBarHeight } : undefined}
            >
              <BarChart
                data={costData}
                layout={vertical ? "vertical" : "horizontal"}
                margin={
                  vertical
                    ? { top: 10, right: 24, left: 140, bottom: 24 }
                    : { top: 10, right: 24, left: 12, bottom: 64 }
                }
              >
                <defs>
                  {costData.map((d) => {
                    const base = getModelColor(d.model)
                    const id = getGradientId("ct", d.model)
                    return (
                      <linearGradient
                        key={id}
                        id={id}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={withAlpha(base, 0.95)} />
                        <stop offset="100%" stopColor={withAlpha(base, 0.55)} />
                      </linearGradient>
                    )
                  })}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                {vertical ? (
                  <>
                    <XAxis
                      type="number"
                      label={{
                        value: "Cost to run tests",
                        position: "insideBottom",
                        offset: -10,
                        className: "fill-muted-foreground",
                      }}
                      className="stroke-muted-foreground"
                    />
                    <YAxis
                      type="category"
                      dataKey="model"
                      width={12}
                      tick={{
                        fontSize: 12,
                        className: "fill-muted-foreground",
                      }}
                      tickFormatter={(v: string) => truncateLabel(v)}
                      className="stroke-muted-foreground"
                    />
                  </>
                ) : (
                  <>
                    <XAxis
                      dataKey="model"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                      className="stroke-muted-foreground"
                    />
                    <YAxis
                      label={{
                        value: "Cost per Test",
                        angle: -90,
                        position: "insideLeft",
                        className: "fill-muted-foreground",
                      }}
                      className="stroke-muted-foreground"
                    />
                  </>
                )}
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: unknown) => [
                    `Avg cost: $${value} per test`,
                  ]}
                  labelFormatter={modelTooltipLabel}
                />
                <Bar
                  dataKey="totalCost"
                  radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                >
                  <LabelList
                    dataKey="totalCost"
                    position={vertical ? "right" : "top"}
                    content={
                      vertical
                        ? barValueLabelHorizontalSmart("", 2, costMax || 1)
                        : barValueLabel("", 2)
                    }
                  />
                  {costData.map((entry) => (
                    <Cell
                      key={entry.model}
                      fill={`url(#${getGradientId("ct", entry.model)})`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="speed" className="animate-in fade-in-50 duration-300">
        <Card className="group relative overflow-hidden transition-all duration-300 hover:border-primary/20">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-medium">
                  Response Speed by Model
                </CardTitle>
                <CardDescription>
                  Average response time in seconds (lower is better)
                </CardDescription>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                duration: {
                  label: "Response Time",
                  color: "hsl(var(--chart-3))",
                },
              }}
              className="h-[420px] sm:h-[520px] w-full"
              style={vertical ? { height: mobileBarHeight } : undefined}
            >
              <BarChart
                data={speedData}
                layout={vertical ? "vertical" : "horizontal"}
                margin={
                  vertical
                    ? { top: 10, right: 24, left: 140, bottom: 24 }
                    : { top: 10, right: 24, left: 12, bottom: 64 }
                }
              >
                <defs>
                  {speedData.map((d) => {
                    const base = getModelColor(d.model)
                    const id = getGradientId("sp", d.model)
                    return (
                      <linearGradient
                        key={id}
                        id={id}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={withAlpha(base, 0.95)} />
                        <stop offset="100%" stopColor={withAlpha(base, 0.55)} />
                      </linearGradient>
                    )
                  })}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                {vertical ? (
                  <>
                    <XAxis
                      type="number"
                      label={{
                        value: "Response Time (s)",
                        position: "insideBottom",
                        offset: -10,
                        className: "fill-muted-foreground",
                      }}
                      className="stroke-muted-foreground"
                    />
                    <YAxis
                      type="category"
                      dataKey="model"
                      width={12}
                      tick={{
                        fontSize: 12,
                        className: "fill-muted-foreground",
                      }}
                      tickFormatter={(v: string) => truncateLabel(v)}
                      className="stroke-muted-foreground"
                    />
                  </>
                ) : (
                  <>
                    <XAxis
                      dataKey="model"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                      className="stroke-muted-foreground"
                    />
                    <YAxis
                      label={{
                        value: "Response Time (s)",
                        angle: -90,
                        position: "insideLeft",
                        className: "fill-muted-foreground",
                      }}
                      className="stroke-muted-foreground"
                    />
                  </>
                )}
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: unknown) => [
                    `Average response time: ${value} seconds`,
                  ]}
                  labelFormatter={modelTooltipLabel}
                />
                <Bar
                  dataKey="duration"
                  radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                >
                  <LabelList
                    dataKey="duration"
                    position={vertical ? "right" : "top"}
                    content={
                      vertical
                        ? barValueLabelHorizontalSmart("s", 2, speedMax || 1)
                        : barValueLabel("s", 2)
                    }
                  />
                  {speedData.map((entry) => (
                    <Cell
                      key={entry.model}
                      fill={`url(#${getGradientId("sp", entry.model)})`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent
        value="combined"
        className="animate-in fade-in-50 duration-300"
      >
        <Card className="group relative overflow-hidden transition-all duration-300 hover:border-primary/20">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-medium">
                  Performance vs Total Cost
                </CardTitle>
                <CardDescription>
                  Top-left is ideal: higher accuracy, lower total cost
                </CardDescription>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                successRate: { label: "Success Rate", color: "var(--chart-1)" },
              }}
              className="h-[420px] sm:h-[520px] w-full"
              style={vertical ? { height: 360 } : undefined}
            >
              <ScatterChart
                margin={{
                  top: 10,
                  right: vertical ? 12 : 120,
                  left: 12,
                  bottom: vertical ? 16 : 32,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  type="number"
                  dataKey="totalCost"
                  name="Total Cost"
                  label={{
                    value: "Total Cost ($)",
                    position: "insideBottom",
                    offset: -20,
                    className: "fill-muted-foreground",
                  }}
                  className="stroke-muted-foreground"
                  domain={[0, "auto"]}
                  tickFormatter={(tick) => tick.toFixed(2)}
                />
                <YAxis
                  type="number"
                  dataKey="successRate"
                  name="Success Rate"
                  unit="%"
                  label={{
                    value: "Success Rate (%)",
                    angle: -90,
                    position: "insideLeft",
                    className: "fill-muted-foreground",
                  }}
                  className="stroke-muted-foreground"
                  domain={[0, 100]}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload
                    if (active && isPerformancePoint(point)) {
                      return (
                        <div className="rounded-lg border border-border bg-popover p-3 shadow-xl backdrop-blur-md">
                          <p className="mb-2 font-medium text-popover-foreground">
                            {point.model}
                          </p>
                          <div className="space-y-1 text-sm">
                            <p className="flex items-center gap-2 text-muted-foreground">
                              Success:{" "}
                              <span className="font-mono font-bold text-primary">
                                {point.successRate.toFixed(1)}%
                              </span>
                            </p>
                            <p className="flex items-center gap-2 text-muted-foreground">
                              Total cost:{" "}
                              <span className="font-mono font-bold text-primary">
                                {currency(point.totalCost)}
                              </span>
                            </p>
                            <p className="flex items-center gap-2 text-muted-foreground">
                              Time:{" "}
                              <span className="font-mono font-bold text-primary">
                                {point.duration.toFixed(2)}s
                              </span>
                            </p>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Scatter data={performanceData} isAnimationActive={false}>
                  {performanceData.map((entry) => (
                    <Cell
                      key={entry.originalModel}
                      fill={getModelColor(entry.originalModel)}
                    />
                  ))}
                  {!vertical ? (
                    <LabelList
                      dataKey="model"
                      content={(props: RechartsLabelProps) => {
                        const nx = toFiniteNumber(props.x)
                        const ny = toFiniteNumber(props.y)
                        const value = props.value
                        if (value == null || typeof value === "boolean") {
                          return null
                        }
                        return (
                          <text
                            x={nx + 10}
                            y={ny}
                            dy={4}
                            textAnchor="start"
                            className="pointer-events-none text-xs font-medium fill-foreground"
                            style={{
                              textShadow: "1px 1px 2px hsl(var(--background))",
                            }}
                          >
                            {String(value)}
                          </text>
                        )
                      }}
                    />
                  ) : null}
                </Scatter>
              </ScatterChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
