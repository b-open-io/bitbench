"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { DonationModal } from "@/components/donation-modal"
import { Button } from "@/components/ui/button"
import type { SuiteWithBalance } from "@/lib/types"
import { cn } from "@/lib/utils"

type LifecycleState = "funding" | "queued" | "pending" | "completed"

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

const STATE_LABEL: Record<LifecycleState, string> = {
  funding: "Funding",
  queued: "Funded, queued to run",
  pending: "Queued to run",
  completed: "Completed",
}

export function FundingPanel({
  suite,
  hasResults,
}: {
  suite: SuiteWithBalance
  hasResults: boolean
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // Optimistic funding: fold locally-sent donations into the server balance
  // so a user who completes funding sees the state advance immediately,
  // without waiting for the next indexer poll.
  const [pledgedUsd, setPledgedUsd] = useState(0)

  const raisedUsd = suite.currentBalanceUsd + pledgedUsd
  const goalUsd = suite.estimatedCostUsd
  const percent = Math.min(100, Math.round((raisedUsd / goalUsd) * 100))
  const remainingUsd = Math.max(0, goalUsd - raisedUsd)
  const reachedGoal = raisedUsd >= goalUsd

  const state: LifecycleState = hasResults
    ? "completed"
    : reachedGoal
      ? "queued"
      : suite.status === "pending"
        ? "pending"
        : "funding"

  const isQueued = state === "queued" || state === "pending"

  const copyAddress = async () => {
    await navigator.clipboard.writeText(suite.donationAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              state === "funding" && "bg-muted-foreground/50",
              isQueued && "bg-chart-4 animate-pulse",
              state === "completed" && "bg-primary",
            )}
          />
          <span className="text-sm font-medium">{STATE_LABEL[state]}</span>
        </div>
        <span className="font-mono text-sm text-muted-foreground">
          {percent}%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            state === "completed" || isQueued ? "bg-primary" : "bg-foreground",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span>
          <span className="font-mono font-medium">{formatUsd(raisedUsd)}</span>{" "}
          <span className="text-muted-foreground">raised</span>
        </span>
        <span className="text-muted-foreground">
          <span className="font-mono">{formatUsd(goalUsd)}</span> goal
        </span>
      </div>

      {isQueued ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          This benchmark is fully funded and queued. Results publish
          automatically once the run completes.
        </p>
      ) : hasResults ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Funded and run. Further funding refreshes the results with the current
          model registry.
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {formatUsd(remainingUsd)} left to reach the goal. Results publish
          automatically once funded and run.
        </p>
      )}

      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Donation address
        </span>
        <button
          type="button"
          onClick={copyAddress}
          className="group flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left transition-colors hover:border-foreground/30"
        >
          <code className="break-all font-mono text-xs text-muted-foreground">
            {suite.donationAddress}
          </code>
          {copied ? (
            <Check className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Copy className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          )}
        </button>
      </div>

      {!isQueued && (
        <Button type="button" onClick={() => setOpen(true)} className="w-full">
          Fund this benchmark
        </Button>
      )}

      <DonationModal
        suite={suite}
        open={open}
        onClose={() => setOpen(false)}
        onDonated={(usd) => setPledgedUsd((prev) => prev + usd)}
      />
    </div>
  )
}
