export const WIDTH_CONFIG = {
  // Use rem values for both so CSS can interpolate the transition
  // max-w-7xl = 80rem (1280px), max-w-[96rem] = 1536px
  results: "max-w-[96rem]",
  suite: "max-w-[96rem]",
  default: "max-w-7xl",
} as const;

export type WidthVariant = keyof typeof WIDTH_CONFIG;

export function getWidthVariant(pathname: string | null): WidthVariant {
  if (pathname === "/results") return "results";
  if (pathname?.startsWith("/suite/")) return "suite";
  return "default";
}
