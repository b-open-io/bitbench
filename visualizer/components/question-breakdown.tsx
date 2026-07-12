"use client"

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  HelpCircle,
  XCircle,
} from "lucide-react"
import { useEffect, useState } from "react"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { QuestionBreakdown, SuiteQuestionBreakdown } from "@/lib/types"

interface QuestionBreakdownProps {
  suiteId: string
  /** Philosophy suites: "correct" means high-pole match, not factual truth */
  philosophy?: boolean
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

function getSuccessRateColor(rate: number): string {
  if (rate >= 80) return "text-green-500"
  if (rate >= 60) return "text-yellow-500"
  if (rate >= 40) return "text-orange-500"
  return "text-red-500"
}

function getSuccessRateBg(rate: number): string {
  if (rate >= 80) return "bg-green-500/10"
  if (rate >= 60) return "bg-yellow-500/10"
  if (rate >= 40) return "bg-orange-500/10"
  return "bg-red-500/10"
}

function QuestionItem({
  question,
  philosophy,
}: {
  question: QuestionBreakdown
  philosophy: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  // Philosophy: low high-pole rate = models took orthodoxy / low pole (interesting)
  const isLowAgreement = question.successRate < 50

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg ${
            isLowAgreement ? "border-l-4 border-primary/40" : ""
          }`}
        >
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>

          <div className="flex items-center gap-2 shrink-0">
            {isLowAgreement ? (
              <AlertTriangle className="h-4 w-4 text-primary" />
            ) : (
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              Q{question.testIndex + 1}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">
              {truncateText(question.prompt, 100)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="secondary"
              className={`${getSuccessRateBg(question.successRate)} ${getSuccessRateColor(
                question.successRate,
              )}`}
            >
              {question.successRate.toFixed(1)}%
            </Badge>
            <span className="text-xs text-muted-foreground">
              {question.correctCount}/{question.totalModels}
            </span>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-12 mr-4 mb-4 p-4 rounded-lg bg-muted/30 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Full prompt</p>
            <p className="text-sm font-mono bg-background/50 p-2 rounded whitespace-pre-wrap">
              {question.prompt}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {philosophy
                ? "High pole (counts toward +leaning)"
                : "Expected answers"}
            </p>
            <div className="flex flex-wrap gap-1">
              {question.answers.map((answer) => (
                <Badge
                  key={`${question.testIndex}-answer-${answer}`}
                  variant="outline"
                  className="font-mono text-xs"
                >
                  {answer}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              {philosophy ? (
                <>
                  Model answers ({question.correctCount} high pole,{" "}
                  {question.totalModels - question.correctCount} low pole /
                  other)
                </>
              ) : (
                <>
                  Model results ({question.correctCount} correct,{" "}
                  {question.totalModels - question.correctCount} incorrect)
                </>
              )}
            </p>
            <div className="grid gap-2">
              {question.modelResults.map((result) => (
                <ModelResultRow
                  key={result.model}
                  result={result}
                  philosophy={philosophy}
                />
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ModelResultRow({
  result,
  philosophy,
}: {
  result: QuestionBreakdown["modelResults"][0]
  philosophy: boolean
}) {
  const [showResponse, setShowResponse] = useState(false)
  const match = result.correct

  return (
    <div className="text-sm">
      <button
        type="button"
        className={`flex w-full items-center gap-3 p-2 rounded cursor-pointer hover:bg-background/50 ${
          match ? "bg-green-500/5" : "bg-muted/40"
        }`}
        onClick={() => setShowResponse(!showResponse)}
      >
        {match ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium flex-1 truncate text-left">
          {result.model}
        </span>
        {philosophy && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {match ? "high pole" : "low pole"}
          </span>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {(result.duration / 1000).toFixed(2)}s
              </span>
            </TooltipTrigger>
            <TooltipContent>Response time</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="h-3 w-3" />${result.cost.toFixed(4)}
              </span>
            </TooltipTrigger>
            <TooltipContent>Cost</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            showResponse ? "rotate-180" : ""
          }`}
        />
      </button>
      {showResponse && (
        <div className="ml-7 mt-2 p-2 rounded bg-background/50 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
          {result.response}
        </div>
      )}
    </div>
  )
}

export function QuestionBreakdownCard({
  suiteId,
  philosophy = false,
}: QuestionBreakdownProps) {
  const [breakdown, setBreakdown] = useState<SuiteQuestionBreakdown | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const title = philosophy ? "Item analysis" : "Question Analysis"

  useEffect(() => {
    async function fetchBreakdown() {
      try {
        setLoading(true)
        const res = await fetch(`/api/suites/${suiteId}/questions`)
        if (!res.ok) {
          if (res.status === 404) {
            setError(
              philosophy
                ? "Per-item answers not synced yet. Re-publish with question breakdown, or run via the CLI complete path."
                : "No detailed results available yet",
            )
          } else {
            throw new Error("Failed to fetch")
          }
          return
        }
        const data = await res.json()
        setBreakdown(data)
      } catch {
        setError("Failed to load question breakdown")
      } finally {
        setLoading(false)
      }
    }

    fetchBreakdown()
  }, [suiteId, philosophy])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium">{title}</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !breakdown) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium">{title}</CardTitle>
          <CardDescription>{error || "No data available"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-center text-sm text-muted-foreground px-6">
            {error ||
              "Detailed per-item data appears after the harness syncs cache to the site."}
          </div>
        </CardContent>
      </Card>
    )
  }

  const lowPoleHeavy = breakdown.questions.filter(
    (q) => q.successRate < 50,
  ).length
  const displayQuestions = showAll
    ? breakdown.questions
    : breakdown.questions.slice(0, 10)

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:border-primary/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-medium">{title}</CardTitle>
            <CardDescription>
              {philosophy ? (
                <>
                  {breakdown.totalQuestions} items × {breakdown.totalModels}{" "}
                  models. Rate = share matching the suite&apos;s{" "}
                  <span className="text-foreground">high pole</span> (not
                  factual correctness).
                  {lowPoleHeavy > 0 && (
                    <span className="ml-1 text-primary">
                      {lowPoleHeavy} items with &lt;50% high-pole agreement
                      (orthodoxy often wins).
                    </span>
                  )}
                </>
              ) : (
                <>
                  {breakdown.totalQuestions} questions across{" "}
                  {breakdown.totalModels} models
                  {lowPoleHeavy > 0 && (
                    <span className="ml-2 text-red-500">
                      ({lowPoleHeavy} under 50%)
                    </span>
                  )}
                </>
              )}
            </CardDescription>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <HelpCircle className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-muted text-center">
            <div className="text-2xl font-bold text-foreground">
              {breakdown.questions.filter((q) => q.successRate < 40).length}
            </div>
            <div className="text-xs text-muted-foreground">
              {philosophy ? "Low pole heavy" : "Hard"} (&lt;40%)
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/70 text-center">
            <div className="text-2xl font-bold text-foreground">
              {
                breakdown.questions.filter(
                  (q) => q.successRate >= 40 && q.successRate < 70,
                ).length
              }
            </div>
            <div className="text-xs text-muted-foreground">
              Split (40–70%)
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold text-foreground">
              {breakdown.questions.filter((q) => q.successRate >= 70).length}
            </div>
            <div className="text-xs text-muted-foreground">
              {philosophy ? "High pole heavy" : "Easy"} (&gt;70%)
            </div>
          </div>
        </div>

        <ScrollArea className="h-[500px]">
          <div className="space-y-1">
            {displayQuestions.map((question) => (
              <QuestionItem
                key={question.testIndex}
                question={question}
                philosophy={philosophy}
              />
            ))}
          </div>
        </ScrollArea>

        {breakdown.questions.length > 10 && !showAll && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => setShowAll(true)}>
              Show all {breakdown.questions.length} items
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
