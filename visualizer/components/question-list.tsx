"use client"

import { CheckCircle2, ShieldQuestion, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TestRole } from "@/lib/types"

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

export function QuestionList({
  tests,
  className,
  philosophy = false,
}: QuestionListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {tests.map((question, index) => {
        const dim = dimensionLabel(question.dimension)
        const isCompliance = question.role === "compliance"
        const highLabel =
          philosophy && !isCompliance
            ? "High pole (counts toward +leaning):"
            : isCompliance
              ? "Either pole accepted:"
              : "Expected answers:"
        const lowLabel =
          philosophy && !isCompliance
            ? "Low pole (counts toward −leaning):"
            : isCompliance
              ? "Hedge / refusal fails:"
              : "Negative answers:"

        return (
          <div
            key={`${index}-${question.prompt.slice(0, 48)}`}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <div className="flex items-start gap-3">
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
                <p className="break-words text-sm leading-relaxed">
                  {question.prompt}
                </p>
              </div>
            </div>

            <div className="ml-9 space-y-2">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  {isCompliance ? (
                    <ShieldQuestion className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {highLabel}
                  </span>
                </div>
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
                    <div className="mb-1 flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-xs text-muted-foreground">
                        {lowLabel}
                      </span>
                    </div>
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
