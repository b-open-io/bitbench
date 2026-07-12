"use client"

/**
 * Neutrality-Project-style bipolar position map for philosophy suites.
 * Marks sit on −1…+1 with center at 0 — not accuracy-style bars from the floor.
 */

import { HelpCircle } from "lucide-react"
import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface PhilosophyModelRow {
  model: string
  leaning?: number
  positionRate?: number
  complianceRate?: number
}

export interface PhilosophyLeaningChartProps {
  models: PhilosophyModelRow[]
  highPole: string
  lowPole: string
  /** Cells used for position scoring (for the help tooltip) */
  positionCellsHint?: string
}

function clampLeaning(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(-1, Math.min(1, n))
}

/** Map leaning −1…+1 to 0%…100% for CSS left */
function leaningToPercent(leaning: number): number {
  return ((clampLeaning(leaning) + 1) / 2) * 100
}

export function leaningWordBand(leaning: number): string {
  const v = clampLeaning(leaning)
  if (v > 0.6) return "Strongly original design"
  if (v > 0.2) return "Lean original design"
  if (v >= -0.2) return "Near center"
  if (v >= -0.6) return "Lean small-block orthodoxy"
  return "Strongly small-block orthodoxy"
}

/** Generic band when poles are not bitcoin-specific */
export function leaningWordBandGeneric(
  leaning: number,
  highPole: string,
  lowPole: string,
): string {
  const v = clampLeaning(leaning)
  const highShort = shortenPole(highPole)
  const lowShort = shortenPole(lowPole)
  if (v > 0.6) return `Strongly ${highShort}`
  if (v > 0.2) return `Lean ${highShort}`
  if (v >= -0.2) return "Near center"
  if (v >= -0.6) return `Lean ${lowShort}`
  return `Strongly ${lowShort}`
}

function shortenPole(label: string, max = 28): string {
  const t = label.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function signedFixed(n: number, decimals = 2): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(decimals)}`
}

/** One-line split summary shown as the card description */
function buildSummary(
  rows: Array<PhilosophyModelRow & { leaning: number }>,
  highPole: string,
  lowPole: string,
): string {
  if (rows.length === 0) return ""
  const leansHigh = rows.filter((r) => r.leaning > 0.2).length
  const leansLow = rows.filter((r) => r.leaning < -0.2).length
  const center = rows.length - leansHigh - leansLow
  const sorted = [...rows].sort((a, b) => b.leaning - a.leaning)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  const range = `range ${signedFixed(bottom.leaning)} to ${signedFixed(top.leaning)}`

  if (leansHigh === rows.length) {
    return `All ${rows.length} models lean ${shortenPole(highPole, 36)} · ${range}`
  }
  if (leansLow === rows.length) {
    return `All ${rows.length} models lean ${shortenPole(lowPole, 36)} · ${range}`
  }
  const parts = [
    `${leansHigh} lean high pole`,
    `${leansLow} lean low pole`,
    center ? `${center} near center` : null,
    range,
  ].filter(Boolean)
  return parts.join(" · ")
}

function modelColor(index: number): string {
  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ]
  return colors[index % colors.length]
}

export function PhilosophyLeaningChart({
  models,
  highPole,
  lowPole,
  positionCellsHint,
}: PhilosophyLeaningChartProps) {
  const rows = useMemo(() => {
    return models
      .filter((m) => m.leaning !== undefined)
      .map((m) => ({
        ...m,
        leaning: clampLeaning(m.leaning as number),
      }))
      .sort((a, b) => b.leaning - a.leaning)
  }, [models])

  const summary = useMemo(
    () => buildSummary(rows, highPole, lowPole),
    [rows, highPole, lowPole],
  )

  const isBitcoinPoles =
    highPole.toLowerCase().includes("satoshi") ||
    highPole.toLowerCase().includes("original")

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium">Position map</CardTitle>
          <CardDescription>
            No leaning scores on this run. Position items must complete for a
            map.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl font-medium">
              Where models land
            </CardTitle>
            <CardDescription>{summary}</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="How to read this map"
                  className="mt-1 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs space-y-2">
                <p>
                  Marks show composite leaning from position items on a bipolar
                  −1…+1 axis — a map of preference under tradeoffs, not a score
                  or a ranking of intelligence.
                </p>
                <p>
                  Compliance probes are tracked separately and do not move the
                  map. Hover a row for position and compliance rates.
                </p>
                {positionCellsHint ? <p>{positionCellsHint}</p> : null}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Axis legend */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
          <p className="text-left text-xs text-muted-foreground sm:pr-2">
            <span className="font-medium text-foreground">−1</span>
            <span className="mt-0.5 block leading-snug">{lowPole}</span>
          </p>
          <p className="text-center text-xs font-medium text-muted-foreground">
            0 · center
          </p>
          <p className="text-left text-xs text-muted-foreground sm:pl-2 sm:text-right">
            <span className="font-medium text-foreground">+1</span>
            <span className="mt-0.5 block leading-snug">{highPole}</span>
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-1 pb-6">
        {/* Shared scale header ticks */}
        <div className="mb-4 hidden pl-[8.5rem] pr-2 sm:block">
          <div className="relative h-5 border-b border-border/80">
            {[-1, -0.5, 0, 0.5, 1].map((tick) => (
              <span
                key={tick}
                className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground"
                style={{ left: `${leaningToPercent(tick)}%` }}
              >
                {tick > 0 ? `+${tick}` : String(tick)}
              </span>
            ))}
          </div>
        </div>

        <TooltipProvider>
          <ul className="space-y-3">
            {rows.map((row, index) => {
              const pct = leaningToPercent(row.leaning)
              const band = isBitcoinPoles
                ? leaningWordBand(row.leaning)
                : leaningWordBandGeneric(row.leaning, highPole, lowPole)
              const color = modelColor(index)

              return (
                <li key={row.model}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex w-full shrink-0 items-baseline justify-between gap-2 sm:w-32 sm:flex-col sm:justify-center sm:gap-0">
                          <span className="truncate text-sm font-medium">
                            {row.model}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground sm:hidden">
                            {signedFixed(row.leaning)}
                          </span>
                        </div>

                        <div className="relative min-w-0 flex-1 py-2">
                          {/* Track */}
                          <div className="relative h-3 rounded-full bg-muted/80">
                            {/* Center line */}
                            <div
                              className="absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-foreground/40"
                              aria-hidden
                            />
                            {/* Diverging fill from center toward mark */}
                            <div
                              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-40"
                              style={{
                                left: row.leaning >= 0 ? "50%" : `${pct}%`,
                                width: `${Math.abs(row.leaning) * 50}%`,
                                backgroundColor: color,
                              }}
                            />
                            {/* Dot */}
                            <div
                              className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-sm ring-1 ring-border"
                              style={{
                                left: `${pct}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>

                        <div className="hidden w-40 shrink-0 flex-col items-end sm:flex">
                          <span className="font-mono text-sm font-medium tabular-nums">
                            {signedFixed(row.leaning)}
                          </span>
                          <span className="text-right text-[11px] leading-tight text-muted-foreground">
                            {band}
                          </span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="space-y-0.5">
                      <p className="font-medium">
                        {row.model}: {signedFixed(row.leaning, 3)}
                      </p>
                      <p className="text-xs">{band}</p>
                      {row.positionRate !== undefined && (
                        <p className="text-xs">
                          Position {row.positionRate.toFixed(0)}% high pole
                        </p>
                      )}
                      {row.complianceRate !== undefined && (
                        <p className="text-xs">
                          Compliance {row.complianceRate.toFixed(0)}% (does not
                          move the map)
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>

                  {/* Mobile-only word band (desktop shows it beside the value) */}
                  <div className="mt-1 sm:hidden">
                    <Badge
                      variant="secondary"
                      className="font-normal text-[10px]"
                    >
                      {band}
                    </Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
