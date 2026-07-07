"use client"

import Link from "next/link"
import { ChainBadge } from "@/components/chain-badge"
import type { SuiteWithBalance } from "@/lib/types"
import { cn } from "@/lib/utils"

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function DonationCard({ suite }: { suite: SuiteWithBalance }) {
  const percent = Math.round(suite.fundingProgress * 100)
  const isCompleted = suite.status === "completed"
  const isQueued = suite.status === "pending" || percent >= 100
  const statusLabel = isCompleted
    ? "Completed"
    : isQueued
      ? "Queued to run"
      : suite.lastRunAt
        ? "Funding next run"
        : "Funding"
  const barWidth = isCompleted ? 100 : Math.min(100, percent)

  return (
    <Link
      href={`/suite/${suite.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-border/60 p-5 transition-colors hover:border-border hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug transition-colors group-hover:text-primary">
          {suite.name}
        </h3>
        <ChainBadge chain={suite.chain} size="sm" />
      </div>

      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {suite.description}
      </p>

      <div className="mt-auto space-y-2 pt-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <div
            className={cn(
              "h-full rounded-full",
              isCompleted || isQueued ? "bg-primary" : "bg-foreground/40",
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{statusLabel}</span>
          <span className="font-mono">
            {formatUsd(suite.currentBalanceUsd)} /{" "}
            {formatUsd(suite.estimatedCostUsd)}
          </span>
        </div>
      </div>
    </Link>
  )
}
