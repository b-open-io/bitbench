"use client";

import type { ComponentPropsWithoutRef } from "react";
import { Badge } from "@/components/ui/badge";
import { WalletConnect } from "@/components/wallet-connect";
import { ThemeToggle } from "@/components/theme-toggle";

const BitcoinSVG = ({
  className,
  ...props
}: ComponentPropsWithoutRef<"svg">) => (
  <svg
    viewBox="0 0 2499.6 2500"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    fill="currentColor"
    {...props}
  >
    <path d="m1741.5 943.8c-16.1-167.4-160.6-223.5-343.2-239.5v-232.3h-141.3v226.1c-37.1 0-75.1.7-112.8 1.5v-227.6h-141.3l-.1 232.1c-30.6.6-60.7 1.2-90 1.2v-.7l-194.9-.1v151s104.4-2 102.6-.1c57.3 0 75.9 33.2 81.3 61.9v264.6c4 0 9.1.2 14.9 1h-14.9l-.1 370.7c-2.5 18-13.1 46.7-53.1 46.8 1.8 1.6-102.7 0-102.7 0l-28.1 168.8h184c34.2 0 67.9.6 100.9.8l.1 234.9h141.2v-232.4c38.7.8 76.2 1.1 112.9 1.1l-.1 231.3h141.3v-234.4c237.6-13.6 404.1-73.5 424.7-296.7 16.7-179.7-67.8-260-202.7-292.4 82.1-41.6 133.4-115.1 121.4-237.6zm-197.8 502.2c0 175.5-300.5 155.6-396.4 155.6v-311.3c95.9.2 396.4-27.3 396.4 155.7zm-65.8-439.1c0 159.7-250.8 141-330.6 141.1v-282.2c79.9 0 330.7-25.4 330.6 141.1z" />
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <BitcoinSVG className="h-6 w-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight">
              Bitbench<span className="text-muted-foreground">.org</span>
            </h1>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Bitcoin AI Benchmark
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="hidden sm:flex border-border bg-muted/50 px-3 py-1 text-xs font-normal text-muted-foreground"
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {modelCount} models
          </Badge>
          <ThemeToggle />
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
