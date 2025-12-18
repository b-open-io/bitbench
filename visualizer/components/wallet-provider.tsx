"use client";

import { YoursProvider, useYoursWallet } from "yours-wallet-provider";
import type { ReactNode } from "react";

interface WalletProviderProps {
  children: ReactNode;
}

// Re-export the provider for use in layout.tsx
export function WalletProvider({ children }: WalletProviderProps) {
  return <YoursProvider>{children}</YoursProvider>;
}

// Re-export the hook for use in components
export { useYoursWallet as useWallet };
