"use client";

import { YoursProvider } from "yours-wallet-provider";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

interface WalletContextType {
  wallet: YoursProvider | null;
  isConnected: boolean;
  address: string | null;
  balance: number | null;
  pubKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendBsv: (
    address: string,
    satoshis: number
  ) => Promise<{ txid: string; rawtx: string } | undefined>;
}

const WalletContext = createContext<WalletContextType>({
  wallet: null,
  isConnected: false,
  address: null,
  balance: null,
  pubKey: null,
  connect: async () => {},
  disconnect: () => {},
  sendBsv: async () => undefined,
});

export function useWallet() {
  return useContext(WalletContext);
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [wallet, setWallet] = useState<YoursProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [pubKey, setPubKey] = useState<string | null>(null);

  useEffect(() => {
    // Initialize wallet provider
    const provider = new YoursProvider();
    setWallet(provider);

    // Check if already connected
    provider.isConnected().then((connected) => {
      if (connected) {
        refreshWalletState(provider);
      }
    });

    // Listen for account changes
    const handleSwitchAccount = () => {
      refreshWalletState(provider);
    };

    const handleSignedOut = () => {
      setIsConnected(false);
      setAddress(null);
      setBalance(null);
      setPubKey(null);
    };

    window.addEventListener("switchAccount", handleSwitchAccount);
    window.addEventListener("signedOut", handleSignedOut);

    return () => {
      window.removeEventListener("switchAccount", handleSwitchAccount);
      window.removeEventListener("signedOut", handleSignedOut);
    };
  }, []);

  const refreshWalletState = async (provider: YoursProvider) => {
    try {
      const connected = await provider.isConnected();
      setIsConnected(connected);

      if (connected) {
        const [addr, bal, pk] = await Promise.all([
          provider.getAddresses(),
          provider.getBalance(),
          provider.getPubKeys(),
        ]);

        setAddress(addr?.bsvAddress || null);
        setBalance(bal?.bsv?.satoshis ?? null);
        setPubKey(pk?.bsvPubKey || null);
      }
    } catch (error) {
      console.error("Error refreshing wallet state:", error);
    }
  };

  const connect = async () => {
    if (!wallet) return;

    try {
      const connected = await wallet.connect();
      if (connected) {
        await refreshWalletState(wallet);
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  const disconnect = () => {
    wallet?.disconnect();
    setIsConnected(false);
    setAddress(null);
    setBalance(null);
    setPubKey(null);
  };

  const sendBsv = async (toAddress: string, satoshis: number) => {
    if (!wallet || !isConnected) return undefined;

    try {
      const result = await wallet.sendBsv([
        {
          address: toAddress,
          satoshis,
        },
      ]);
      // Refresh balance after sending
      await refreshWalletState(wallet);
      return result;
    } catch (error) {
      console.error("Error sending BSV:", error);
      throw error;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isConnected,
        address,
        balance,
        pubKey,
        connect,
        disconnect,
        sendBsv,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
