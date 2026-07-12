"use client"

import {
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  HelpCircle,
  ShieldQuestion,
  XCircle,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  QuestionBreakdown,
  SuiteQuestionBreakdown,
  TestRole,
} from "@/lib/types"
import { cn } from "@/lib/utils"

export interface QuestionListTest {
  prompt: string
  answers: string[]
  negative_answers?: string[]
  role?: TestRole
  dimension?: string
}

interface QuestionListProps {
  tests: QuestionListTest[]
  className?: string
  /** When true, position items use high/low pole labels instead of expected/negative */
  philosophy?: boolean
  /** When set, per-item model answers are fetched and merged into each row */
  suiteId?: string
  /** Suite version the answers must match; guards against stale breakdowns */
  version?: string
}

const DIMENSION_LABELS: Record<string, string> = {
  self_custody: "Self-custody",
  fixed_supply: "Fixed supply",
  peer_payments: "Peer payments",
  sound_money: "Sound money",
  cantillon: "Cantillon effects",
  monetary_competition: "Monetary competition",
  capacity: "Capacity growth",
  node_equilibrium: "Node equilibrium",
  pow_vote: "1-CPU-1-vote",
  finality: "Finality / first-seen",
  base_retail: "Base-layer retail",
  protocol_stability: "Protocol stability",
  true_p2p: "True peer-to-peer",
  tradeoffs: "Trade-offs",
  prices_info: "Prices as information",
  incentives: "Incentives",
  fairness: "Fairness",
  evolved_institutions: "Evolved institutions",
  concentrated_power: "Concentrated power",
}

function dimensionLabel(id: string | undefined): string | null {
  if (!id) return null
  return DIMENSION_LABELS[id] ?? id.replace(/_/g, " ")
}

function roleBadge(role: TestRole | undefined, philosophy: boolean) {
  if (!role) return null
  if (role === "compliance") {
    return (
      <Badge variant="outline" className="font-normal text-xs">
        Compliance probe
      </Badge>
    )
  }
  if (role === "grade") {
    return (
      <Badge variant="outline" className="font-normal text-xs">
        Graded item
      </Badge>
    )
  }
  if (role === "position" && philosophy) {
    return (
      <Badge variant="outline" className="font-normal text-xs">
        Position
      </Badge>
    )
  }
  return null
}

/**
 * Three rate bands, colored to match the answer chips below: primary for the
 * high pole (or correct), destructive for the low pole (or incorrect),
 * chart-4 for contested items.
 */
type RateBand = "low" | "mid" | "high"

function rateBand(rate: number): RateBand {
  if (rate >= 70) return "high"
  if (rate >= 40) return "mid"
  return "low"
}

const BAND_BADGE: Record<RateBand, string> = {
  high: "bg-primary/10 text-primary",
  mid: "bg-chart-4/15 text-chart-4",
  low: "bg-destructive/10 text-destructive",
}

const BAND_BORDER: Record<RateBand, string> = {
  high: "border-l-primary/60",
  mid: "border-l-chart-4/60",
  low: "border-l-destructive/60",
}

function RateBadge({
  question,
  philosophy,
}: {
  question: QuestionBreakdown
  philosophy: boolean
}) {
  const band = rateBand(question.successRate)
  return (
    <Badge
      variant="secondary"
      className={cn("shrink-0 font-mono font-normal text-xs", BAND_BADGE[band])}
    >
      {question.correctCount}/{question.totalModels}
      {philosophy ? " high" : ""}
    </Badge>
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
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted/60",
          match ? "bg-primary/5" : "bg-destructive/5",
        )}
        onClick={() => setShowResponse(!showResponse)}
      >
        {match ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-destructive/80" />
        )}
        <span className="flex-1 truncate text-left font-medium">
          {result.model}
        </span>
        {philosophy && (
          <span
            className={cn(
              "text-[10px] uppercase tracking-wide",
              match ? "text-primary" : "text-destructive/80",
            )}
          >
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
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            showResponse && "rotate-180",
          )}
        />
      </button>
      {showResponse && (
        <div className="ml-7 mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background/50 p-2 font-mono text-xs">
          {result.response}
        </div>
      )}
    </div>
  )
}

function QuestionItem({
  question,
  index,
  breakdown,
  philosophy,
}: {
  question: QuestionListTest
  index: number
  breakdown?: QuestionBreakdown
  philosophy: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dim = dimensionLabel(question.dimension)
  const isCompliance = question.role === "compliance"
  const highLabel =
    philosophy && !isCompliance
      ? "High pole (counts toward +leaning)"
      : isCompliance
        ? "Either pole accepted"
        : "Expected answers"
  const lowLabel =
    philosophy && !isCompliance
      ? "Low pole (counts toward −leaning)"
      : isCompliance
        ? "Hedge / refusal fails"
        : "Negative answers"

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "rounded-lg border border-border",
        breakdown && "border-l-2",
        breakdown && BAND_BORDER[rateBand(breakdown.successRate)],
      )}
    >
      <CollapsibleTrigger asChild>
        <div className="flex cursor-pointer items-start gap-3 rounded-lg p-4 transition-colors hover:bg-muted/50">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            {(question.role || dim) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {roleBadge(question.role, philosophy)}
                {dim && (
                  <Badge
                    variant="secondary"
                    className="font-normal text-xs text-muted-foreground"
                  >
                    {dim}
                  </Badge>
                )}
              </div>
            )}
            <p
              className={cn(
                "break-words text-sm leading-relaxed",
                !isOpen && "line-clamp-2",
              )}
            >
              {question.prompt}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {breakdown && (
              <RateBadge question={breakdown} philosophy={philosophy} />
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-4 px-4 pb-4 pl-[3.25rem]">
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              {isCompliance ? (
                <ShieldQuestion className="h-3.5 w-3.5 text-primary" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              )}
              {highLabel}
            </p>
            <div className="flex flex-wrap gap-1">
              {question.answers.map((answer) => (
                <Badge
                  key={`${index}-answer-${answer}`}
                  variant="secondary"
                  className="max-w-full whitespace-normal break-words bg-primary/10 text-left font-mono text-xs text-primary [overflow-wrap:anywhere]"
                >
                  {answer}
                </Badge>
              ))}
            </div>
          </div>

          {question.negative_answers &&
            question.negative_answers.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  {lowLabel}
                </p>
                <div className="flex flex-wrap gap-1">
                  {question.negative_answers.map((answer) => (
                    <Badge
                      key={`${index}-negative-${answer}`}
                      variant="secondary"
                      className="max-w-full whitespace-normal break-words bg-destructive/10 text-left font-mono text-xs text-destructive [overflow-wrap:anywhere]"
                    >
                      {answer}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

          {breakdown && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                {philosophy ? (
                  <>
                    Model answers ({breakdown.correctCount} high pole,{" "}
                    {breakdown.totalModels - breakdown.correctCount} low pole /
                    other)
                  </>
                ) : (
                  <>
                    Model results ({breakdown.correctCount} correct,{" "}
                    {breakdown.totalModels - breakdown.correctCount} incorrect)
                  </>
                )}
              </p>
              <div className="grid gap-2">
                {breakdown.modelResults.map((result) => (
                  <ModelResultRow
                    key={result.model}
                    result={result}
                    philosophy={philosophy}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function DistributionChips({
  questions,
  philosophy,
}: {
  questions: QuestionBreakdown[]
  philosophy: boolean
}) {
  const low = questions.filter((q) => q.successRate < 40).length
  const mid = questions.filter(
    (q) => q.successRate >= 40 && q.successRate < 70,
  ).length
  const high = questions.filter((q) => q.successRate >= 70).length

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge
        variant="secondary"
        className={cn("font-normal text-xs", BAND_BADGE.low)}
      >
        {low} {philosophy ? "low-pole heavy" : "hard"}
      </Badge>
      <Badge
        variant="secondary"
        className={cn("font-normal text-xs", BAND_BADGE.mid)}
      >
        {mid} split
      </Badge>
      <Badge
        variant="secondary"
        className={cn("font-normal text-xs", BAND_BADGE.high)}
      >
        {high} {philosophy ? "high-pole heavy" : "easy"}
      </Badge>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="How item rates work"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {philosophy ? (
              <p>
                Each item&apos;s rate is the share of models matching the
                suite&apos;s high pole — not factual correctness. Low-pole heavy
                &lt;40%, split 40–70%, high-pole heavy &gt;70%. Expand an item
                for per-model answers.
              </p>
            ) : (
              <p>
                Each item&apos;s rate is the share of models answering
                correctly. Hard &lt;40%, split 40–70%, easy &gt;70%. Expand an
                item for per-model answers.
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

export function QuestionList({
  tests,
  className,
  philosophy = false,
  suiteId,
  version,
}: QuestionListProps) {
  const [breakdown, setBreakdown] = useState<SuiteQuestionBreakdown | null>(
    null,
  )

  useEffect(() => {
    if (!suiteId) return
    let cancelled = false
    async function fetchBreakdown() {
      try {
        const url = version
          ? `/api/suites/${suiteId}/questions?version=${encodeURIComponent(version)}`
          : `/api/suites/${suiteId}/questions`
        const res = await fetch(url)
        if (!res.ok) return
        const data: SuiteQuestionBreakdown = await res.json()
        // A breakdown from another version indexes different prompts —
        // merging it would attach answers to the wrong questions.
        if (version && data.version !== version) return
        if (!cancelled) setBreakdown(data)
      } catch {
        // Static list still renders; per-model answers are additive.
      }
    }
    fetchBreakdown()
    return () => {
      cancelled = true
    }
  }, [suiteId, version])

  const breakdownByIndex = new Map(
    (breakdown?.questions ?? []).map((q) => [q.testIndex, q]),
  )

  // Suite file missing but results synced: still show every item.
  const items: QuestionListTest[] =
    tests.length > 0
      ? tests
      : (breakdown?.questions ?? []).map((q) => ({
          prompt: q.prompt,
          answers: q.answers,
        }))

  return (
    <div className={cn("space-y-3", className)}>
      {breakdown && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DistributionChips
            questions={breakdown.questions}
            philosophy={philosophy}
          />
          <span className="text-xs text-muted-foreground">
            {breakdown.totalQuestions} items × {breakdown.totalModels} models
          </span>
        </div>
      )}

      <div className="max-h-[44rem] space-y-3 overflow-y-auto pr-1">
        {items.map((question, index) => (
          <QuestionItem
            key={question.prompt}
            question={question}
            index={index}
            breakdown={breakdownByIndex.get(index)}
            philosophy={philosophy}
          />
        ))}
      </div>
    </div>
  )
}
