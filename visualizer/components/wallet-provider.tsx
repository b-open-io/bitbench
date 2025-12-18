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
import { type ThemeToken, validateThemeToken } from "@theme-token/sdk";
import { useThemeToken } from "./theme-provider";

interface WalletState {
  isReady: boolean;
  isConnected: boolean;
  addresses: Addresses | null;
  balance: Balance | null;
  themeTokens: ThemeToken[];
  isLoadingThemes: boolean;
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
  const [themeTokens, setThemeTokens] = useState<ThemeToken[]>([]);
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);

  // Get theme context to set available themes
  const themeContext = useThemeToken();

  // Fetch theme tokens from wallet ordinals
  const fetchThemeTokens = useCallback(async () => {
    if (!wallet?.isReady || typeof wallet.getOrdinals !== "function") return;

    setIsLoadingThemes(true);

    try {
      const response = await wallet.getOrdinals({ limit: 100 });
      const tokens: ThemeToken[] = [];

      const ordinals = Array.isArray(response)
        ? response
        : (response?.ordinals ?? []);

      for (const ordinal of ordinals) {
        try {
          // Check if it's a theme token by looking at MAP metadata
          const mapData = ordinal?.origin?.data?.map as
            | Record<string, string>
            | undefined;

          // Theme tokens have app: "theme-token" and type: "theme"
          if (mapData?.app === "theme-token" && mapData?.type === "theme") {
            const content = ordinal?.origin?.data?.insc?.file?.json;
            if (content && typeof content === "object") {
              const result = validateThemeToken(content);
              if (result.valid) {
                tokens.push(result.theme);
              }
            }
          } else {
            // Also check if it's a valid theme without MAP metadata (legacy)
            const content = ordinal?.origin?.data?.insc?.file?.json;
            if (content && typeof content === "object") {
              const result = validateThemeToken(content);
              if (result.valid) {
                tokens.push(result.theme);
              }
            }
          }
        } catch {
          // Skip invalid ordinals
        }
      }

      setThemeTokens(tokens);
      themeContext.setAvailableThemes(tokens);
    } catch (err) {
      console.error("Error fetching theme tokens:", err);
    } finally {
      setIsLoadingThemes(false);
    }
  }, [wallet, themeContext]);

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

        // Fetch theme tokens when connected
        await fetchThemeTokens();
      } else {
        setAddresses(null);
        setBalance(null);
        setThemeTokens([]);
        themeContext.setAvailableThemes([]);
      }
    } catch (err) {
      console.error("Error refreshing wallet state:", err);
      setIsConnected(false);
      setAddresses(null);
      setBalance(null);
    }
  }, [wallet, fetchThemeTokens, themeContext]);

  // Set up event listeners for wallet state changes
  useEffect(() => {
    // Check that wallet is fully loaded with all methods
    if (!wallet?.isReady || typeof wallet.on !== "function") return;

    const handleSignedOut = () => {
      console.log("Wallet signed out");
      setIsConnected(false);
      setAddresses(null);
      setBalance(null);
      setThemeTokens([]);
      themeContext.setAvailableThemes([]);
      themeContext.resetTheme();
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
      if (typeof wallet?.removeListener === "function") {
        wallet.removeListener("signedOut", handleSignedOut);
        wallet.removeListener("switchAccount", handleSwitchAccount);
      }
    };
  }, [wallet, wallet?.isReady, refreshState, themeContext]);

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
      setThemeTokens([]);
      themeContext.setAvailableThemes([]);
      themeContext.resetTheme();
    } catch (err) {
      console.error("Error disconnecting wallet:", err);
    }
  }, [wallet, themeContext]);

  const state: WalletState = {
    isReady: wallet?.isReady ?? false,
    isConnected,
    addresses,
    balance,
    themeTokens,
    isLoadingThemes,
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

// Hook to access wallet state - returns null if not yet mounted (ssr: false)
export function useWallet(): WalletState | null {
  return useContext(WalletContext);
}
