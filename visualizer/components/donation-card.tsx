"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { SuiteWithBalance } from "@/lib/types";
import { Clock, DollarSign, Zap } from "lucide-react";

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

export function DonationCard({ suite, onDonate }: DonationCardProps) {
  const progressPercent = Math.round(suite.fundingProgress * 100);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{suite.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {suite.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Funding Progress */}
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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>{suite.testCount} tests</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>{formatUsd(suite.estimatedCostUsd)} est.</span>
          </div>
        </div>

        {/* Last Run */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Last run: {formatDate(suite.lastRunAt)}</span>
        </div>

        {/* Donate Button */}
        <Button
          onClick={() => onDonate(suite)}
          className="mt-auto w-full"
          variant={suite.status === "funding" ? "default" : "secondary"}
          disabled={suite.status === "pending"}
        >
          {suite.status === "pending"
            ? "Awaiting Benchmark Run"
            : suite.status === "completed"
              ? "View Results"
              : progressPercent >= 100
                ? "Fully Funded"
                : "Fund This Benchmark"}
        </Button>
      </CardContent>
    </Card>
  );
}
