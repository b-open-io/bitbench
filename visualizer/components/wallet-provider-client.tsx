"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Dynamic import with SSR disabled - yours-wallet-provider accesses browser APIs
const WalletProvider = dynamic(
  () => import("./wallet-provider").then((mod) => mod.WalletProvider),
  { ssr: false }
);

export function WalletProviderClient({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
