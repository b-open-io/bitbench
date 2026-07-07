"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface QuestionListTest {
  prompt: string
  answers: string[]
  negative_answers?: string[]
}

interface QuestionListProps {
  tests: QuestionListTest[]
  className?: string
}

export function QuestionList({ tests, className }: QuestionListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {tests.map((question, index) => (
        <div
          key={question.prompt}
          className="space-y-3 rounded-lg border border-border p-4"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {index + 1}
            </span>
            <p className="min-w-0 break-words text-sm leading-relaxed">
              {question.prompt}
            </p>
          </div>

          <div className="ml-9 space-y-2">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">
                  Expected answers:
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {question.answers.map((answer) => (
                  <Badge
                    key={`${question.prompt}-answer-${answer}`}
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
                      Negative answers:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {question.negative_answers.map((answer) => (
                      <Badge
                        key={`${question.prompt}-negative-${answer}`}
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
      ))}
    </div>
  )
}
