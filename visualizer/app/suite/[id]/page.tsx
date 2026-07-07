import { ArrowLeft, Clock, ExternalLink, Tag } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BenchmarkCharts } from "@/components/benchmark-charts"
import { ChainBadge } from "@/components/chain-badge"
import { FundSuiteButton } from "@/components/fund-suite-button"
import { PageContainer } from "@/components/page-container"
import { QuestionBreakdownCard } from "@/components/question-breakdown"
import { QuestionList } from "@/components/question-list"
import { SiteHeader } from "@/components/site-header"
import { SuiteSwitcher } from "@/components/suite-switcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { getLatestRun } from "@/lib/kv"
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
  }))
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

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function ModelsCard({
  models,
  modelCount,
  usesDefaultModels,
}: {
  models: ModelRegistryEntry[]
  modelCount: number
  usesDefaultModels: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Models</CardTitle>
        <CardDescription>
          The resolved model set for this benchmark run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          <span>{modelCount} models will run against this suite</span>
          {usesDefaultModels && (
            <span className="text-muted-foreground">
              {" "}
              (the default current-model registry)
            </span>
          )}
        </p>

        <details className="rounded-lg border border-border bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Show model names
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {models.map((model) => (
              <span
                key={model.id}
                className="break-words font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]"
              >
                {model.name}
              </span>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
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

export default async function SuiteResultsPage({ params }: PageProps) {
  const { id } = await params

  const [suite, latestRun, allSuites, suiteFile] = await Promise.all([
    getSuiteWithBalance(id),
    getLatestRun(id),
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

  // Check if we have results
  const rankings = latestRun?.rankings ?? []
  const hasResults = rankings.length > 0
  const fundingPercent = Math.round(suite.fundingProgress * 100)
  const preRunStatus = suite.status === "pending" ? "pending" : "funding"

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader modelCount={defaultModels.length} />

      {/* Full-width section: Header + Charts */}
      <PageContainer forceWidth="full" className="py-8">
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
                    <Tag className="h-3 w-3" />v{suite.version}
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

        {/* Charts - Full Width */}
        {hasResults ? (
          <BenchmarkCharts rankings={transformRankings(rankings)} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Funding</CardTitle>
                      <CardDescription>
                        Results publish automatically after the benchmark runs.
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className="capitalize text-muted-foreground"
                    >
                      {preRunStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{fundingPercent}%</span>
                    </div>
                    <Progress value={fundingPercent} className="h-2" />
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {formatUsd(suite.currentBalanceUsd)} raised
                      </span>
                      <span className="text-muted-foreground">
                        {formatUsd(suite.estimatedCostUsd)} goal
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-sm font-medium">Donation address</h2>
                    <code className="block rounded-md bg-muted px-3 py-2 text-xs leading-relaxed break-all text-muted-foreground">
                      {suite.donationAddress}
                    </code>
                  </div>

                  <FundSuiteButton suite={suite} />
                </CardContent>
              </Card>

              <ModelsCard
                models={modelInfo.models}
                modelCount={modelInfo.modelCount}
                usesDefaultModels={modelInfo.usesDefaultModels}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  {suite.testCount} prompts from version {suite.version}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <QuestionList tests={suiteFile?.tests ?? []} />
                <p className="text-sm text-muted-foreground">
                  <a
                    href="https://github.com/b-open-io/bitbench/tree/master/bench/tests"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Full item bank in the repository
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </PageContainer>

      {/* Centered section: Question Breakdown */}
      {hasResults && (
        <PageContainer forceWidth="default" className="pb-8">
          <QuestionBreakdownCard suiteId={id} />
        </PageContainer>
      )}
    </div>
  )
}
