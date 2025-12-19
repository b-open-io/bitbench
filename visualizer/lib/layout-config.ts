export const WIDTH_CONFIG = {
  results: "max-w-full",
  suite: "max-w-full",
  default: "max-w-7xl",
} as const;

export type WidthVariant = keyof typeof WIDTH_CONFIG;

export function getWidthVariant(pathname: string | null): WidthVariant {
  if (pathname === "/results") return "results";
  if (pathname?.startsWith("/suite/")) return "suite";
  return "default";
}
