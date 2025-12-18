"use client";

import { useWallet } from "./wallet-provider";
import { useThemeToken } from "./theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletMinimal, Power, Files, CircleCheck, PaintBucket, LoaderCircle, History } from "lucide-react";
import { useState, useEffect, useCallback, type MouseEvent } from "react";
import type { ThemeToken } from "@theme-token/sdk";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(satoshis: number | null): string {
  if (satoshis === null) return "...";
  const bsv = satoshis / 100_000_000;
  return `${bsv.toFixed(4)} BSV`;
}

// Visual representation of theme colors
function ThemeStripes({
  styles,
  mode,
}: {
  styles: { light: Record<string, string>; dark: Record<string, string> };
  mode: "light" | "dark";
}) {
  const colors = [
    styles[mode].primary,
    styles[mode].secondary,
    styles[mode].accent,
    styles[mode].background,
  ];

  return (
    <div className="flex h-4 w-8 overflow-hidden rounded border border-border">
      {colors.map((color, i) => (
        <div key={i} className="flex-1" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

export function WalletConnect() {
  const walletState = useWallet();
  const themeState = useThemeToken();
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Get the raw wallet from state (if available)
  const wallet = walletState?.wallet;
  const themeTokens = walletState?.themeTokens ?? [];
  const isLoadingThemes = walletState?.isLoadingThemes ?? false;

  const refreshState = useCallback(async () => {
    if (!wallet?.isReady || typeof wallet.isConnected !== "function") return;

    try {
      const connected = await wallet.isConnected();
      setIsConnected(connected);

      if (connected) {
        const [addresses, bal] = await Promise.all([
          wallet.getAddresses(),
          wallet.getBalance(),
        ]);
        setAddress(addresses?.bsvAddress || null);
        setBalance(bal?.satoshis ?? null);
      } else {
        setAddress(null);
        setBalance(null);
      }
    } catch (error) {
      console.error("Error refreshing wallet state:", error);
    }
  }, [wallet]);

  useEffect(() => {
    refreshState();

    // Listen for wallet events
    const handleSwitchAccount = () => refreshState();
    const handleSignedOut = () => {
      setIsConnected(false);
      setAddress(null);
      setBalance(null);
    };

    if (wallet?.isReady && typeof wallet.on === "function") {
      wallet.on("switchAccount", handleSwitchAccount);
      wallet.on("signedOut", handleSignedOut);

      return () => {
        if (typeof wallet.removeListener === "function") {
          wallet.removeListener("switchAccount", handleSwitchAccount);
          wallet.removeListener("signedOut", handleSignedOut);
        }
      };
    }
  }, [wallet, refreshState]);

  const handleConnect = async () => {
    if (!wallet?.isReady || typeof wallet.connect !== "function") return;
    try {
      await wallet.connect();
      await refreshState();
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  const handleDisconnect = async () => {
    if (!wallet?.isReady || typeof wallet.disconnect !== "function") return;
    try {
      await wallet.disconnect();
      setIsConnected(false);
      setAddress(null);
      setBalance(null);
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectTheme = (theme: ThemeToken, e: MouseEvent) => {
    themeState.applyThemeAnimated(theme, e);
  };

  const handleResetTheme = () => {
    themeState.resetTheme();
  };

  if (!isConnected) {
    return (
      <Button onClick={handleConnect} variant="outline" className="gap-2">
        <WalletMinimal className="h-4 w-4 fill-current" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <WalletMinimal className="h-4 w-4 fill-current" />
          <span className="hidden sm:inline">
            {formatAddress(address || "")}
          </span>
          <span className="text-muted-foreground">{formatBalance(balance)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Theme selector submenu */}
        {themeTokens.length > 0 && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <PaintBucket className="h-4 w-4 fill-current" />
                <span>Themes</span>
                {isLoadingThemes && (
                  <LoaderCircle className="h-3 w-3 animate-spin ml-auto" />
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                {themeTokens.map((theme) => (
                  <DropdownMenuItem
                    key={theme.name}
                    onClick={(e) => handleSelectTheme(theme, e)}
                    className="gap-2 cursor-pointer"
                  >
                    <ThemeStripes styles={theme.styles} mode={themeState.mode} />
                    <span className="flex-1 truncate">{theme.name}</span>
                    {themeState.activeTheme?.name === theme.name && (
                      <CircleCheck className="h-4 w-4 text-primary fill-current" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleResetTheme}
                  className="gap-2 cursor-pointer"
                >
                  <History className="h-4 w-4 fill-current" />
                  Reset to default
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={copyAddress} className="gap-2">
          {copied ? (
            <CircleCheck className="h-4 w-4 fill-current" />
          ) : (
            <Files className="h-4 w-4 fill-current" />
          )}
          {copied ? "Copied!" : "Copy Address"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDisconnect}
          className="gap-2 text-destructive"
        >
          <Power className="h-4 w-4 fill-current" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
