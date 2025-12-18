"use client";

import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { WalletConnect } from "@/components/wallet-connect";
import { ThemeToggle } from "@/components/theme-toggle";
import { GitHubStars } from "@/components/github-stars";

// Logo matching favicon.svg
const LogoIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={className}>
    <rect width="32" height="32" rx="8" className="fill-background" />
    <path d="M10 3h2v4h10v6h-8v6h12v6H12v4h-2v-4H8V7h2V3z" className="fill-primary" />
  </svg>
);

interface SiteHeaderProps {
  modelCount: number;
}

export function SiteHeader({ modelCount }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <LogoIcon className="h-10 w-10" />
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight">
              Bitbench<span className="text-muted-foreground">.org</span>
            </h1>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Bitcoin AI Benchmark
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/about"
            className="hidden sm:inline-flex rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            About
          </Link>
          <Badge
            variant="outline"
            className="hidden md:flex border-border bg-muted/50 px-3 py-1 text-xs font-normal text-muted-foreground"
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {modelCount} models
          </Badge>
          <GitHubStars />
          <ThemeToggle />
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
