"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "./wallet-provider";
import type { SuiteWithBalance } from "@/lib/types";
import { Loader2, CheckCircle, AlertCircle, Wallet } from "lucide-react";

interface DonationModalProps {
  suite: SuiteWithBalance | null;
  open: boolean;
  onClose: () => void;
}

type DonationStatus = "idle" | "sending" | "success" | "error";

// BSV price estimate (could be fetched from API)
const BSV_PRICE_USD = 50;

function usdToSats(usd: number): number {
  return Math.ceil((usd / BSV_PRICE_USD) * 100_000_000);
}

export function DonationModal({ suite, open, onClose }: DonationModalProps) {
  const wallet = useWallet();
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [amountUsd, setAmountUsd] = useState("");
  const [status, setStatus] = useState<DonationStatus>("idle");
  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amountSats = amountUsd ? usdToSats(Number.parseFloat(amountUsd)) : 0;
  const remainingUsd = suite
    ? suite.estimatedCostUsd - suite.currentBalanceUsd
    : 0;

  const refreshState = useCallback(async () => {
    if (!wallet?.isReady) return;

    try {
      const connected = await wallet.isConnected();
      setIsConnected(connected);

      if (connected) {
        const addresses = await wallet.getAddresses();
        setAddress(addresses?.bsvAddress || null);
      }
    } catch (err) {
      console.error("Error refreshing wallet state:", err);
    }
  }, [wallet]);

  useEffect(() => {
    if (open) {
      refreshState();
    }
  }, [open, refreshState]);

  const handleConnect = async () => {
    if (!wallet?.isReady) {
      window.open("https://yours.org", "_blank");
      return;
    }
    try {
      await wallet.connect();
      await refreshState();
    } catch (err) {
      console.error("Error connecting wallet:", err);
    }
  };

  const handleDonate = async () => {
    if (!suite || !amountSats || !wallet?.isReady) return;

    setStatus("sending");
    setError(null);

    try {
      const result = await wallet.sendBsv([
        {
          address: suite.donationAddress,
          satoshis: amountSats,
        },
      ]);

      if (result?.txid) {
        setTxid(result.txid);
        setStatus("success");

        // Record donation to API
        await fetch(`/api/suites/${suite.id}/donate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txid: result.txid,
            amountSats,
            fromAddress: address,
          }),
        });
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  const handleClose = () => {
    setAmountUsd("");
    setStatus("idle");
    setTxid(null);
    setError(null);
    onClose();
  };

  const setQuickAmount = (usd: number) => {
    setAmountUsd(usd.toString());
  };

  if (!suite) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund Benchmark</DialogTitle>
          <DialogDescription>{suite.name}</DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="h-12 w-12 text-primary" />
            <p className="text-center font-medium">Donation successful!</p>
            <p className="text-sm text-muted-foreground text-center">
              Transaction ID:
              <br />
              <code className="text-xs break-all">{txid}</code>
            </p>
            <Button onClick={handleClose} className="mt-2">
              Close
            </Button>
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-center font-medium">Transaction failed</p>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <Button onClick={() => setStatus("idle")} variant="outline">
              Try Again
            </Button>
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <Wallet className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-muted-foreground">
              Connect your wallet to donate
            </p>
            <Button onClick={handleConnect} className="gap-2">
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Funding info */}
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Goal</span>
                  <span>${suite.estimatedCostUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raised</span>
                  <span>${suite.currentBalanceUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium mt-1 pt-1 border-t border-border">
                  <span>Remaining</span>
                  <span>${remainingUsd.toFixed(2)}</span>
                </div>
              </div>

              {/* Amount input */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  min="0.01"
                  step="0.01"
                />
                {amountSats > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {amountSats.toLocaleString()} satoshis
                  </p>
                )}
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickAmount(0.5)}
                >
                  $0.50
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickAmount(1)}
                >
                  $1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickAmount(remainingUsd)}
                >
                  ${remainingUsd.toFixed(2)}
                </Button>
              </div>

              {/* Address display */}
              <div className="text-xs text-muted-foreground">
                <p>Sending to:</p>
                <code className="break-all">{suite.donationAddress}</code>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleDonate}
                disabled={!amountSats || status === "sending"}
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  `Donate $${amountUsd || "0"}`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
