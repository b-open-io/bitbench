"use client";

import { usePathname } from "next/navigation";
import { getWidthVariant, WIDTH_CONFIG } from "@/lib/layout-config";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Override the automatic width detection */
  forceWidth?: "full" | "default";
}

/**
 * Container that applies consistent max-width based on the current route.
 * Use forceWidth="default" for sections that should always be centered (e.g., content below charts).
 * Use forceWidth="full" to force full width regardless of route.
 */
export function PageContainer({ children, className = "", forceWidth }: PageContainerProps) {
  const pathname = usePathname();

  let widthClass: string;
  if (forceWidth === "full") {
    widthClass = "max-w-full";
  } else if (forceWidth === "default") {
    widthClass = "max-w-7xl";
  } else {
    const widthVariant = getWidthVariant(pathname);
    widthClass = WIDTH_CONFIG[widthVariant];
  }

  return (
    <div className={`mx-auto px-4 transition-[max-width] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${widthClass} ${className}`}>
      {children}
    </div>
  );
}
