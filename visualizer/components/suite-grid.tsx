"use client"

import { DonationCard } from "@/components/donation-card"
import type { SuiteWithBalance } from "@/lib/types"

interface SuiteGridProps {
  suites: SuiteWithBalance[]
  loading: boolean
}

function TileSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4 rounded-xl border border-border/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="h-5 w-1/2 rounded bg-muted" />
        <div className="h-5 w-10 rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
      <div className="mt-auto space-y-2 pt-1">
        <div className="h-1 w-full rounded-full bg-muted" />
        <div className="flex justify-between">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}

export function SuiteGrid({ suites, loading }: SuiteGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
          <TileSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (suites.length === 0) {
    return (
      <p className="py-8 text-muted-foreground">No benchmarks available yet.</p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {suites.map((suite) => (
        <DonationCard key={suite.id} suite={suite} />
      ))}
    </div>
  )
}
