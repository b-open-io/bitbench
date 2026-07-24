import { ArrowLeft, Clock, ExternalLink, Tag } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BenchmarkCharts } from "@/components/benchmark-charts"
import { ChainBadge } from "@/components/chain-badge"
import { FundingPanel } from "@/components/funding-panel"
import { PageContainer } from "@/components/page-container"
import { QuestionList } from "@/components/question-list"
import { SiteHeader } from "@/components/site-header"
import { SuiteSwitcher } from "@/components/suite-switcher"
import { Button } from "@/components/ui/button"
import { getBenchmarkRuns, getLatestRun } from "@/lib/kv"
import { getMergedCells } from "@/lib/results"
import {
  getAllSuites,
  getDefaultModels,
  getSuiteFile,
  getSuiteModelInfo,
  getSuiteWithBalance,
} from "@/lib/suites"
import type { ModelRegistryEntry, ModelResult } from "@/lib/types"

interface PageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ version?: string }>
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
    averageCostPerTest: r.total > 0 ? r.cost / r.total : 0,
    positionRate: r.positionRate,
    complianceRate: r.complianceRate,
    leaning: r.leaning,
  }))
}

const AI_POLE_LABELS: Record<
  string,
  { high: string; low: string; metric: "leaning" | "score" }
> = {
  "ai-bitcoin-philosophy": {
    high: "Original design (Satoshi / whitepaper)",
    low: "Small-block / mediated orthodoxy",
    metric: "leaning",
  },
  "ai-econ-philosophy": {
    high: "Free-market / constrained vision",
    low: "Interventionist / unconstrained vision",
    metric: "leaning",
  },
  "ai-truthfulness": {
    high: "Truthful",
    low: "Mistaken / sycophantic",
    metric: "score",
  },
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never"
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ModelsList({
  models,
  modelCount,
  usesDefaultModels,
  runDatesByModel,
}: {
  models: ModelRegistryEntry[]
  modelCount: number
  usesDefaultModels: boolean
  runDatesByModel: Map<string, string>
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{modelCount} models</span>{" "}
        run against this suite
        {usesDefaultModels ? ", the full current-model registry." : "."}
      </p>

      <details className="group">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <span className="group-open:hidden">Show all models</span>
          <span className="hidden group-open:inline">Hide models</span>
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {models.map((model) => (
            <div key={model.name} className="min-w-0">
              <span className="block truncate font-mono text-xs text-muted-foreground">
                {model.name}
              </span>
              {runDatesByModel.has(model.name) && (
                <span className="block text-[11px] text-muted-foreground/70">
                  {formatDate(runDatesByModel.get(model.name) ?? null)}
                </span>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const [suite, latestRun] = await Promise.all([
    getSuiteWithBalance(id),
    getLatestRun(id),
  ])

  if (!suite) {
    return { title: "Suite Not Found - Bitbench" }
  }

  const hasResults = (latestRun?.rankings ?? []).length > 0
  const title = hasResults
    ? `${suite.name} Results - Bitbench`
    : `${suite.name} - Bitbench`
  const description = hasResults
    ? `${suite.description} See how ${suite.modelCount}+ AI models perform on ${suite.testCount} tests.`
    : `Fund this benchmark to test ${suite.modelCount}+ AI models on ${suite.testCount} ${suite.name} prompts.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://bitbench.org/suite/${id}`,
      type: "article",
    },
    twitter: {
      title,
      description,
    },
  }
}

export default async function SuiteResultsPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const { version: requestedVersion } = (await searchParams) ?? {}

  const [suite, runs, allSuites, suiteFile] = await Promise.all([
    getSuiteWithBalance(id),
    getBenchmarkRuns(id, 50),
    getAllSuites(),
    getSuiteFile(id),
  ])

  if (!suite) {
    notFound()
  }

  const [modelInfo, defaultModels] = await Promise.all([
    getSuiteModelInfo(id),
    getDefaultModels(),
  ])

  // The version wall: runs of earlier suite versions are real history but
  // not comparable to the current questions. Every stored run keeps its
  // version, so older results stay reachable via ?version=.
  const versionsWithRuns = [...new Set(runs.map((run) => run.version))]
  const pastVersions = versionsWithRuns.filter((v) => v !== suite.version)
  const isViewingPast =
    requestedVersion !== undefined &&
    requestedVersion !== suite.version &&
    versionsWithRuns.includes(requestedVersion)
  const viewingVersion = isViewingPast ? requestedVersion : suite.version

  const cells = await getMergedCells(id, viewingVersion)
  const hasResults = cells.length > 0
  const currentHasResults = versionsWithRuns.includes(suite.version)
  const latestPastVersion = pastVersions[0] ?? null
  const runDatesByModel = new Map(cells.map((cell) => [cell.model, cell.runAt]))
  const runIds = new Set(cells.map((cell) => cell.runId ?? cell.runAt))
  const cellDates = cells.map((cell) => new Date(cell.runAt).getTime())
  const earliestRun = cellDates.length
    ? new Date(Math.min(...cellDates)).toISOString()
    : null
  const latestCellRun = cellDates.length
    ? new Date(Math.max(...cellDates)).toISOString()
    : null

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader modelCount={defaultModels.length} />

      <PageContainer forceWidth="default" className="py-10">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="Back to benchmarks"
              className="mt-1 shrink-0"
            >
              <Link href="/" aria-label="Back to benchmarks">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <ChainBadge chain={suite.chain} />
                <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  <Tag className="h-3 w-3" />v{suite.version}
                </span>
                {hasResults && latestCellRun && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last run {formatDate(latestCellRun)}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                {suite.name}
              </h1>
              <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">
                {suite.description}
              </p>
            </div>
          </div>
          <SuiteSwitcher currentSuiteId={id} suites={allSuites} />
        </div>

        {/* Results */}
        <section className="mt-12 border-t border-border pt-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Results</h2>
            {hasResults && runIds.size > 1 && earliestRun && latestCellRun ? (
              <p className="text-sm text-muted-foreground">
                {runIds.size} runs, {formatDate(earliestRun)} to{" "}
                {formatDate(latestCellRun)}. Each model shows its own run date.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Comparable within version {viewingVersion}.
                {!isViewingPast && pastVersions.length > 0 && (
                  <>
                    {" "}
                    Earlier:{" "}
                    {pastVersions.map((v, i) => (
                      <span key={v}>
                        {i > 0 && ", "}
                        <Link
                          href={`/suite/${id}?version=${encodeURIComponent(v)}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          v{v}
                        </Link>
                      </span>
                    ))}
                  </>
                )}
              </p>
            )}
          </div>

          {isViewingPast && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
              <span>
                Archived results from v{viewingVersion}. The questions have
                since changed in v{suite.version}.
              </span>
              <Link
                href={`/suite/${id}`}
                className="font-medium underline underline-offset-4"
              >
                Back to v{suite.version}
              </Link>
            </div>
          )}

          {hasResults ? (
            <BenchmarkCharts
              rankings={transformRankings(cells)}
              chain={suite.chain}
              poles={AI_POLE_LABELS[id]}
            />
          ) : (
            <div className="py-8">
              <p className="text-2xl font-semibold tracking-tight text-muted-foreground/70">
                {latestPastVersion
                  ? `Version ${suite.version} not run yet.`
                  : "Not run yet."}
              </p>
              <p className="mt-2 max-w-md leading-relaxed text-muted-foreground">
                {latestPastVersion ? (
                  <>
                    The questions changed in v{suite.version}, so earlier scores
                    aren&apos;t comparable. Fund this version to run the new
                    set.
                  </>
                ) : (
                  <>
                    Fund this benchmark to run {suite.testCount} prompts across{" "}
                    {suite.modelCount} models. An operator runs the suite
                    locally once funded; results then appear here.
                  </>
                )}
              </p>
              {latestPastVersion && (
                <Button asChild variant="outline" className="mt-4">
                  <Link
                    href={`/suite/${id}?version=${encodeURIComponent(latestPastVersion)}`}
                  >
                    View v{latestPastVersion} results
                  </Link>
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Body: questions (main) + funding & models (sticky sidebar) */}
        <div className="mt-12 grid grid-cols-1 gap-x-16 gap-y-12 border-t border-border pt-10 lg:grid-cols-3">
          {/* Sidebar — first in the DOM so it leads on mobile (funding is
              the primary action), floated right and made sticky on desktop */}
          <aside className="space-y-10 lg:sticky lg:top-24 lg:col-start-3 lg:row-start-1 lg:self-start">
            <div>
              <h2 className="mb-6 text-lg font-semibold">Funding</h2>
              <FundingPanel suite={suite} hasResults={currentHasResults} />
            </div>
            <div className="border-t border-border pt-8">
              <h2 className="mb-6 text-lg font-semibold">Models</h2>
              <ModelsList
                models={modelInfo.models}
                modelCount={modelInfo.modelCount}
                usesDefaultModels={modelInfo.usesDefaultModels}
                runDatesByModel={runDatesByModel}
              />
            </div>
          </aside>

          {/* Main — questions */}
          <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Questions</h2>
              <span className="text-sm text-muted-foreground">
                {isViewingPast
                  ? `version ${viewingVersion}`
                  : `${suite.testCount} prompts, version ${suite.version}`}
              </span>
            </div>
            <QuestionList
              // Past versions render from the archived breakdown; the suite
              // file only holds the current version's questions.
              tests={isViewingPast ? [] : (suiteFile?.tests ?? [])}
              suiteId={hasResults ? id : undefined}
              version={viewingVersion}
              philosophy={
                suite.chain === "ai" &&
                (id === "ai-bitcoin-philosophy" || id === "ai-econ-philosophy")
              }
            />
            <p className="mt-6">
              <a
                href="https://github.com/b-open-io/bitbench/tree/master/bench/tests"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Full item bank in the repository
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
