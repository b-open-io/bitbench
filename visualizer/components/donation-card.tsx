"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChainBadge } from "@/components/chain-badge";
import { cn } from "@/lib/utils";
import type { SuiteWithBalance } from "@/lib/types";
import { Clock, Zap, Tag, CheckCircle2, Loader2, Trophy } from "lucide-react";

interface DonationCardProps {
  suite: SuiteWithBalance;
  onDonate: (suite: SuiteWithBalance) => void;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never run";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500 ring-1 ring-inset ring-amber-500/20">
        <Loader2 className="h-3 w-3 animate-spin" />
        Queued
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-500 ring-1 ring-inset ring-green-500/20">
        <Trophy className="h-3 w-3" />
        Results Ready
      </span>
    );
  }
  return null;
}

export function DonationCard({ suite, onDonate }: DonationCardProps) {
  const progressPercent = Math.round(suite.fundingProgress * 100);
  const isPending = suite.status === "pending";
  const isCompleted = suite.status === "completed";

  return (
    <Card
      className={cn(
        "flex flex-col transition-colors",
        isPending && "border-amber-500/30 bg-amber-500/5",
        isCompleted && "border-green-500/30 bg-green-500/5"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={suite.status} />
            </div>
            <CardTitle className="text-lg">{suite.name}</CardTitle>
          </div>
          <ChainBadge chain={suite.chain} size="sm" />
        </div>
        <CardDescription className="line-clamp-2">
          {suite.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Funding Progress - different display for pending/completed */}
        {isPending ? (
          <div className="rounded-lg bg-amber-500/10 p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-500">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Fully Funded</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Benchmark will run soon
            </p>
          </div>
        ) : isCompleted ? (
          <div className="rounded-lg bg-green-500/10 p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-green-500">
              <Trophy className="h-5 w-5" />
              <span className="font-semibold">Benchmark Complete</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(suite.lastRunAt)}
              {suite.lastRunVersion && ` (v${suite.lastRunVersion})`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Funding Progress</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatUsd(suite.currentBalanceUsd)} raised</span>
              <span>{formatUsd(suite.estimatedCostUsd)} goal</span>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>{suite.testCount} tests</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag className="h-4 w-4" />
            <span>v{suite.version}</span>
          </div>
        </div>

        {/* Last Run - only show for funding status */}
        {!isPending && !isCompleted && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {suite.lastRunAt
                ? `Last run: ${formatDate(suite.lastRunAt)}${suite.lastRunVersion ? ` (v${suite.lastRunVersion})` : ""}`
                : "Never run"}
            </span>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={() => onDonate(suite)}
          className={cn(
            "mt-auto w-full",
            isPending && "bg-amber-500 hover:bg-amber-600 text-white"
          )}
          variant={isCompleted ? "default" : isPending ? "default" : "default"}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Awaiting Benchmark Run
            </>
          ) : isCompleted ? (
            "View Results"
          ) : progressPercent >= 100 ? (
            "Fully Funded"
          ) : (
            "Fund This Benchmark"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
