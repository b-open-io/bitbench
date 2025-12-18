"use client";

import { useWallet } from "./wallet-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, LogOut, Copy, Check } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(satoshis: number | null): string {
  if (satoshis === null) return "...";
  const bsv = satoshis / 100_000_000;
  return `${bsv.toFixed(4)} BSV`;
}

export function WalletConnect() {
  const wallet = useWallet();
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshState = useCallback(async () => {
    if (!wallet?.isReady) return;

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

    if (wallet?.isReady) {
      wallet.on("switchAccount", handleSwitchAccount);
      wallet.on("signedOut", handleSignedOut);

      return () => {
        wallet.removeListener("switchAccount", handleSwitchAccount);
        wallet.removeListener("signedOut", handleSignedOut);
      };
    }
  }, [wallet, refreshState]);

  const handleConnect = async () => {
    if (!wallet?.isReady) return;
    try {
      await wallet.connect();
      await refreshState();
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  const handleDisconnect = async () => {
    if (!wallet?.isReady) return;
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

  if (!isConnected) {
    return (
      <Button onClick={handleConnect} variant="outline" className="gap-2">
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">
            {formatAddress(address || "")}
          </span>
          <span className="text-muted-foreground">{formatBalance(balance)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={copyAddress} className="gap-2">
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copied!" : "Copy Address"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDisconnect}
          className="gap-2 text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
