"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SuiteWithBalance } from "@/lib/types";

interface FundingStatsProps {
  suites: SuiteWithBalance[];
  modelCount: number;
}

export function FundingStats({ suites, modelCount }: FundingStatsProps) {
  const totalRaised = suites.reduce((sum, s) => sum + s.currentBalanceUsd, 0);
  const totalGoal = suites.reduce((sum, s) => sum + s.estimatedCostUsd, 0);
  const fullyFunded = suites.filter((s) => s.fundingProgress >= 1).length;

  return (
    <div className="grid gap-4 mb-8 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Raised</CardDescription>
          <CardTitle className="text-2xl">${totalRaised.toFixed(2)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            of ${totalGoal.toFixed(2)} goal
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Test Suites</CardDescription>
          <CardTitle className="text-2xl">{suites.length}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {fullyFunded} fully funded
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>AI Models</CardDescription>
          <CardTitle className="text-2xl">{modelCount}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">tested per benchmark</p>
        </CardContent>
      </Card>
    </div>
  );
}
