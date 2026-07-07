"use client"

import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Play,
  Tag,
  Trophy,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { ChainBadge } from "@/components/chain-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { SuiteWithBalance } from "@/lib/types"
import { cn } from "@/lib/utils"

interface DonationCardProps {
  suite: SuiteWithBalance
  onDonate: (suite: SuiteWithBalance) => void
  /** Optional: top performer from last run */
  lastRunScore?: number
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function DonationCard({
  suite,
  onDonate,
  lastRunScore,
}: DonationCardProps) {
  const progressPercent = Math.round(suite.fundingProgress * 100)
  const isPending = suite.status === "pending"
  const hasResults = suite.status === "completed" || suite.lastRunAt
  const isFullyFunded = progressPercent >= 100

  return (
    <Card
      className={cn(
        "flex flex-col transition-colors",
        isPending && "border-chart-4/30 bg-chart-4/5",
      )}
    >
      {/* Header: Name + Chain Badge */}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">
              <Link
                href={`/suite/${suite.id}`}
                className="transition-colors hover:text-primary"
              >
                {suite.name}
              </Link>
            </CardTitle>
          </div>
          <ChainBadge chain={suite.chain} size="sm" />
        </div>
        <CardDescription className="line-clamp-2">
          {suite.description}
        </CardDescription>
      </CardHeader>

      {/* Body: Funding Progress (always visible) */}
      <CardContent className="flex-1 flex flex-col gap-3">
        {/* Funding Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {isPending ? (
                <span className="flex items-center gap-1.5 text-chart-4">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Running Benchmark...
                </span>
              ) : isFullyFunded ? (
                <span className="flex items-center gap-1.5 text-primary">
                  <CheckCircle2 className="h-3 w-3" />
                  Fully Funded
                </span>
              ) : suite.lastRunAt ? (
                "Funding next run"
              ) : (
                "Funding"
              )}
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            className={cn("h-2", isPending && "[&>div]:bg-chart-4")}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatUsd(suite.currentBalanceUsd)} raised</span>
            <span>{formatUsd(suite.estimatedCostUsd)} goal</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            <span>{suite.testCount} tests</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Tag className="h-3 w-3" />
            <span>v{suite.version}</span>
          </div>
        </div>

        {/* Donate Button */}
        <Button
          onClick={() => onDonate(suite)}
          className={cn(
            "w-full",
            isPending &&
              "bg-chart-4 hover:bg-chart-4/90 text-primary-foreground",
          )}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Benchmark Running
            </>
          ) : isFullyFunded ? (
            "Add More Funding"
          ) : (
            <>
              <Play className="mr-1.5 h-4 w-4" />
              Run Benchmark
            </>
          )}
        </Button>

        {/* Footer: Last Run Results or Details Link */}
        {hasResults ? (
          <div className="mt-1 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-chart-4" />
                <span className="text-muted-foreground">
                  Last Run
                  {suite.lastRunVersion && (
                    <span className="text-foreground font-medium">
                      {" "}
                      v{suite.lastRunVersion}
                    </span>
                  )}
                  {lastRunScore !== undefined && (
                    <span className="text-primary font-medium">
                      : {lastRunScore.toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
              <Link
                href={`/suite/${suite.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View Results
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-1 pt-3 border-t border-border">
            <Link
              href={`/suite/${suite.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Details
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
