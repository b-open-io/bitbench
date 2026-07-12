"use client"

/**
 * Neutrality-Project-style bipolar position map for philosophy suites.
 * Marks sit on −1…+1 with center at 0 — not accuracy-style bars from the floor.
 */

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
  /** Cells used for position scoring (for caption) */
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

function buildHeadline(
  rows: Array<PhilosophyModelRow & { leaning: number }>,
  highPole: string,
  lowPole: string,
): { title: string; body: string } {
  if (rows.length === 0) {
    return { title: "No position scores yet", body: "" }
  }
  const leansHigh = rows.filter((r) => r.leaning > 0.2).length
  const leansLow = rows.filter((r) => r.leaning < -0.2).length
  const center = rows.length - leansHigh - leansLow
  const avg =
    rows.reduce((s, r) => s + r.leaning, 0) / Math.max(1, rows.length)
  const sorted = [...rows].sort((a, b) => b.leaning - a.leaning)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]

  if (leansHigh === rows.length) {
    return {
      title: `All ${rows.length} models lean ${shortenPole(highPole, 36)}`,
      body: `Composite leaning from +${bottom.leaning.toFixed(2)} to +${top.leaning.toFixed(2)} (mean ${avg >= 0 ? "+" : ""}${avg.toFixed(2)}). Average can hide hard dimensions where models still take the opposite pole.`,
    }
  }
  if (leansLow === rows.length) {
    return {
      title: `All ${rows.length} models lean ${shortenPole(lowPole, 36)}`,
      body: `Composite leaning from ${bottom.leaning.toFixed(2)} to ${top.leaning.toFixed(2)} (mean ${avg >= 0 ? "+" : ""}${avg.toFixed(2)}).`,
    }
  }
  return {
    title: "Models split across the design axis",
    body: `${leansHigh} lean high pole, ${leansLow} lean low pole${center ? `, ${center} near center` : ""}. Range ${bottom.leaning.toFixed(2)} to ${top.leaning >= 0 ? "+" : ""}${top.leaning.toFixed(2)}.`,
  }
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

  const headline = useMemo(
    () => buildHeadline(rows, highPole, lowPole),
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
    <div className="space-y-4">
      {/* Headline finding — Neutrality-style */}
      <div className="rounded-xl border border-border bg-card/80 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Headline
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
          {headline.title}
        </h3>
        {headline.body ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {headline.body}
          </p>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-medium">Where models land</CardTitle>
          <CardDescription>
            Position items only. Marks sit on a bipolar axis — not a score.
            {positionCellsHint ? ` ${positionCellsHint}` : ""}
          </CardDescription>

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

          <ul className="space-y-3">
            {rows.map((row, index) => {
              const pct = leaningToPercent(row.leaning)
              const band = isBitcoinPoles
                ? leaningWordBand(row.leaning)
                : leaningWordBandGeneric(row.leaning, highPole, lowPole)
              const color = modelColor(index)
              const sign =
                row.leaning > 0 ? "+" : row.leaning === 0 ? "" : ""

              return (
                <li key={row.model} className="group">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex w-full shrink-0 items-baseline justify-between gap-2 sm:w-32 sm:flex-col sm:justify-center sm:gap-0">
                      <span className="truncate text-sm font-medium">
                        {row.model}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground sm:hidden">
                        {sign}
                        {row.leaning.toFixed(2)}
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
                            left:
                              row.leaning >= 0
                                ? "50%"
                                : `${pct}%`,
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
                          title={`${row.model}: ${sign}${row.leaning.toFixed(3)}`}
                        />
                      </div>
                    </div>

                    <div className="hidden w-40 shrink-0 flex-col items-end sm:flex">
                      <span className="font-mono text-sm font-medium tabular-nums">
                        {sign}
                        {row.leaning.toFixed(2)}
                      </span>
                      <span className="text-right text-[11px] leading-tight text-muted-foreground">
                        {band}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-0 sm:pl-[8.5rem]">
                    <Badge
                      variant="secondary"
                      className="font-normal text-[10px] sm:hidden"
                    >
                      {band}
                    </Badge>
                    {row.positionRate !== undefined && (
                      <span className="text-[11px] text-muted-foreground">
                        Position {row.positionRate.toFixed(0)}% high pole
                      </span>
                    )}
                    {row.complianceRate !== undefined && (
                      <span className="text-[11px] text-muted-foreground">
                        · Compliance {row.complianceRate.toFixed(0)}%
                        <span className="text-muted-foreground/70">
                          {" "}
                          (does not move the map)
                        </span>
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Read as a map of preference under tradeoffs, not a ranking of
            intelligence. Higher on the original-design pole does not mean
            “better model.”
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
