"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChainBadge } from "@/components/chain-badge";
import type { TestSuite } from "@/lib/types";

interface SuiteSwitcherProps {
  currentSuiteId: string;
  suites: TestSuite[];
}

export function SuiteSwitcher({ currentSuiteId, suites }: SuiteSwitcherProps) {
  const router = useRouter();
  const currentSuite = suites.find((s) => s.id === currentSuiteId);

  // Filter to only show suites with results (completed status)
  const completedSuites = suites.filter((s) => s.status === "completed");

  if (completedSuites.length <= 1) {
    // No need for switcher if only one suite has results
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {currentSuite && (
            <>
              <ChainBadge chain={currentSuite.chain} size="sm" />
              <span className="max-w-[200px] truncate">{currentSuite.name}</span>
            </>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Switch Test Suite</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {completedSuites.map((suite) => (
          <DropdownMenuItem
            key={suite.id}
            className={`flex items-center gap-2 cursor-pointer ${
              suite.id === currentSuiteId ? "bg-accent" : ""
            }`}
            onClick={() => router.push(`/suite/${suite.id}`)}
          >
            <ChainBadge chain={suite.chain} size="sm" />
            <span className="flex-1 truncate">{suite.name}</span>
            {suite.id === currentSuiteId && (
              <span className="text-xs text-muted-foreground">Current</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
