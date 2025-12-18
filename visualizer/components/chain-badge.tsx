import { type Chain, CHAIN_INFO } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChainBadgeProps {
  chain: Chain;
  size?: "sm" | "md";
  className?: string;
}

export function ChainBadge({ chain, size = "md", className }: ChainBadgeProps) {
  const info = CHAIN_INFO[chain];

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-md border",
        info.bgColor,
        info.color,
        "border-current/20",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className
      )}
    >
      {info.name}
    </span>
  );
}

// Icon versions for each chain (simplified logos)
export function ChainIcon({ chain, className }: { chain: Chain; className?: string }) {
  const info = CHAIN_INFO[chain];

  // Simple circle with first letter for now
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold",
        info.bgColor,
        info.color,
        "h-5 w-5 text-[10px]",
        className
      )}
    >
      {info.name[0]}
    </span>
  );
}
