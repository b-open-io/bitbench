"use client"

import { ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { Suspense, useEffect, useMemo, useState } from "react"
import { SiteHeader } from "@/components/site-header"
import { SponsorSection } from "@/components/sponsor-section"
import { SuiteGrid } from "@/components/suite-grid"
import type { Chain, SuiteWithBalance } from "@/lib/types"
import { CHAIN_INFO } from "@/lib/types"

interface ResultsSummary {
  totalCompletedSuites: number
  totalModelsEvaluated: number
  topPerformer: { model: string; score: number } | null
}

function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`
}

function BenchmarkVisualizerContent() {
  const [suites, setSuites] = useState<SuiteWithBalance[]>([])
  const [suitesLoading, setSuitesLoading] = useState(true)
  const [resultsSummary, setResultsSummary] = useState<ResultsSummary | null>(
    null,
  )
  const [chainFilter, setChainFilter] = useState<Chain | "all">("all")

  const modelCount = useMemo(
    () =>
      suites.length > 0
        ? Math.max(...suites.map((suite) => suite.modelCount))
        : (resultsSummary?.totalModelsEvaluated ?? 0),
    [suites, resultsSummary],
  )

  const totalGoal = useMemo(
    () => suites.reduce((sum, s) => sum + s.estimatedCostUsd, 0),
    [suites],
  )

  const filteredSuites = useMemo(
    () =>
      chainFilter === "all"
        ? suites
        : suites.filter((s) => s.chain === chainFilter),
    [suites, chainFilter],
  )

  const availableChains = useMemo(() => {
    const chains = new Set(suites.map((s) => s.chain))
    return Array.from(chains).sort() as Chain[]
  }, [suites])

  useEffect(() => {
    async function fetchSuites() {
      try {
        const res = await fetch("/api/suites")
        if (res.ok) {
          const data = await res.json()
          setSuites(data.suites)
        }
      } catch (error) {
        console.error("Failed to fetch suites:", error)
      } finally {
        setSuitesLoading(false)
      }
    }
    fetchSuites()
  }, [])

  useEffect(() => {
    async function fetchResultsSummary() {
      try {
        const res = await fetch("/api/results")
        if (res.ok) {
          const data = await res.json()
          // Knowledge index only — never use a cross-suite blend that mixes
          // philosophy leaning with accuracy.
          const board =
            data.knowledgeIndex?.models ?? data.globalLeaderboard ?? []
          setResultsSummary({
            totalCompletedSuites: data.totalCompletedSuites,
            totalModelsEvaluated: data.totalModelsEvaluated,
            topPerformer: board[0]
              ? {
                  model: board[0].model,
                  score: board[0].averageScore,
                }
              : null,
          })
        }
      } catch (error) {
        console.error("Failed to fetch results:", error)
      }
    }
    fetchResultsSummary()
  }, [])

  const stats = [
    { value: modelCount ? `${modelCount}` : "—", label: "AI models per run" },
    {
      value: suites.length ? `${suites.length}` : "—",
      label: "open benchmarks",
    },
    {
      value: totalGoal ? formatUsd(totalGoal) : "—",
      label: "to fully fund all",
    },
  ]

  const topPerformer = resultsSummary?.topPerformer

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,oklch(from_var(--primary)_l_c_h/0.10),transparent)]" />

      <SiteHeader modelCount={modelCount} />

      <main className="relative mx-auto max-w-7xl px-4">
        {/* Hero */}
        <section className="grid gap-10 py-16 duration-700 animate-in fade-in slide-in-from-bottom-2 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:py-24">
          <div>
            <h1 className="max-w-2xl text-balance text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Benchmark AI models on Bitcoin, truth, and markets.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Anyone can fund an open benchmark and see how every current AI
              model performs, with results published transparently.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#benchmarks"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Browse benchmarks
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/results"
                className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View results
              </Link>
            </div>
          </div>

          {/* Stat stack */}
          <dl className="grid grid-cols-3 gap-6 border-t border-border pt-8 lg:grid-cols-1 lg:gap-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-mono text-3xl font-semibold tracking-tight lg:text-4xl">
                  {stat.value}
                </dd>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section className="grid gap-8 border-t border-border py-12 sm:grid-cols-3">
          {[
            {
              step: "Fund",
              body: "Donate BSV to a benchmark's address until it reaches the goal. Every selection has its own deterministic address.",
            },
            {
              step: "Run",
              body: "Once funded, the suite runs against every current model resolved live from the OpenRouter catalog.",
            },
            {
              step: "Publish",
              body: "Scores publish here and on-chain, versioned so results stay comparable and drift over time is visible.",
            },
          ].map((item) => (
            <div key={item.step}>
              <h3 className="text-sm font-semibold">{item.step}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </section>

        {/* Benchmarks */}
        <section
          id="benchmarks"
          className="scroll-mt-20 border-t border-border py-12"
        >
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Benchmarks</h2>
              <p className="mt-1 text-muted-foreground">
                Fund one to test {modelCount || "every"}+ models. Pick a chain
                to filter.
              </p>
            </div>

            {availableChains.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setChainFilter("all")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    chainFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {availableChains.map((chain) => {
                  const info = CHAIN_INFO[chain]
                  const isActive = chainFilter === chain
                  return (
                    <button
                      type="button"
                      key={chain}
                      onClick={() => setChainFilter(chain)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        isActive
                          ? `${info.bgColor} ${info.color}`
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {info.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {resultsSummary && resultsSummary.totalCompletedSuites > 0 && (
            <p className="mb-6 text-sm text-muted-foreground">
              {resultsSummary.totalCompletedSuites} benchmark
              {resultsSummary.totalCompletedSuites !== 1 ? "s" : ""} completed
              {topPerformer && (
                <>
                  {". "}Bitcoin Knowledge Index leader:{" "}
                  <span className="font-medium text-foreground">
                    {topPerformer.model}
                  </span>{" "}
                  at {topPerformer.score.toFixed(1)}% accuracy
                </>
              )}
              {". "}
              <Link
                href="/results"
                className="font-medium text-primary hover:text-primary/80"
              >
                See all results
              </Link>
            </p>
          )}

          <SuiteGrid suites={filteredSuites} loading={suitesLoading} />
        </section>
      </main>

      <SponsorSection />
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  )
}

export default function BenchmarkVisualizer() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BenchmarkVisualizerContent />
    </Suspense>
  )
}
