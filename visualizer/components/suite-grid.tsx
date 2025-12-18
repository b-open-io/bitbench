"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DonationCard } from "@/components/donation-card";
import type { SuiteWithBalance } from "@/lib/types";

interface SuiteGridProps {
  suites: SuiteWithBalance[];
  loading: boolean;
  onDonate: (suite: SuiteWithBalance) => void;
}

export function SuiteGrid({ suites, loading, onDonate }: SuiteGridProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-2 w-full bg-muted rounded mb-4" />
              <div className="h-10 w-full bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (suites.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            No test suites available. Configure environment variables to enable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {suites.map((suite) => (
        <DonationCard key={suite.id} suite={suite} onDonate={onDonate} />
      ))}
    </div>
  );
}
