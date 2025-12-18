"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { YoursProvider, useYoursWallet } from "yours-wallet-provider";
import type { Addresses, Balance } from "yours-wallet-provider";

interface WalletState {
  isReady: boolean;
  isConnected: boolean;
  addresses: Addresses | null;
  balance: Balance | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshState: () => Promise<void>;
  // Pass through the raw wallet for sendBsv, signMessage, etc.
  wallet: ReturnType<typeof useYoursWallet>;
}

const WalletContext = createContext<WalletState | null>(null);

function WalletStateProvider({ children }: { children: ReactNode }) {
  const wallet = useYoursWallet();
  const [isConnected, setIsConnected] = useState(false);
  const [addresses, setAddresses] = useState<Addresses | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);

  const refreshState = useCallback(async () => {
    // Check both isReady flag AND that methods exist (wallet is fully loaded)
    if (!wallet?.isReady || typeof wallet.isConnected !== "function") {
      setIsConnected(false);
      setAddresses(null);
      setBalance(null);
      return;
    }

    try {
      const connected = await wallet.isConnected();
      setIsConnected(connected);

      if (connected) {
        const [addrs, bal] = await Promise.all([
          wallet.getAddresses(),
          wallet.getBalance(),
        ]);
        setAddresses(addrs || null);
        setBalance(bal || null);
      } else {
        setAddresses(null);
        setBalance(null);
      }
    } catch (err) {
      console.error("Error refreshing wallet state:", err);
      setIsConnected(false);
      setAddresses(null);
      setBalance(null);
    }
  }, [wallet]);

  // Set up event listeners for wallet state changes
  useEffect(() => {
    // Check that wallet is fully loaded with all methods
    if (!wallet?.isReady || typeof wallet.on !== "function") return;

    const handleSignedOut = () => {
      console.log("Wallet signed out");
      setIsConnected(false);
      setAddresses(null);
      setBalance(null);
    };

    const handleSwitchAccount = () => {
      console.log("Wallet account switched");
      // Refresh state to get new account details
      refreshState();
    };

    // Subscribe to wallet events
    wallet.on("signedOut", handleSignedOut);
    wallet.on("switchAccount", handleSwitchAccount);

    // Initial state refresh
    refreshState();

    // Cleanup listeners on unmount
    return () => {
      if (typeof wallet.removeListener === "function") {
        wallet.removeListener("signedOut", handleSignedOut);
        wallet.removeListener("switchAccount", handleSwitchAccount);
      }
    };
  }, [wallet, wallet?.isReady, refreshState]);

  const connect = useCallback(async () => {
    // Check wallet is fully loaded
    if (!wallet?.isReady || typeof wallet.connect !== "function") {
      // Open Yours wallet download page if not installed
      window.open("https://yours.org", "_blank");
      return;
    }

    try {
      await wallet.connect();
      await refreshState();
    } catch (err) {
      console.error("Error connecting wallet:", err);
    }
  }, [wallet, refreshState]);

  const disconnect = useCallback(async () => {
    if (!wallet?.isReady || typeof wallet.disconnect !== "function") return;

    try {
      await wallet.disconnect();
      setIsConnected(false);
      setAddresses(null);
      setBalance(null);
    } catch (err) {
      console.error("Error disconnecting wallet:", err);
    }
  }, [wallet]);

  const state: WalletState = {
    isReady: wallet?.isReady ?? false,
    isConnected,
    addresses,
    balance,
    connect,
    disconnect,
    refreshState,
    wallet,
  };

  return (
    <WalletContext.Provider value={state}>{children}</WalletContext.Provider>
  );
}

interface WalletProviderProps {
  children: ReactNode;
}

// Main provider that wraps YoursProvider and our state management
export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <YoursProvider>
      <WalletStateProvider>{children}</WalletStateProvider>
    </YoursProvider>
  );
}

// Hook to access wallet state
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
