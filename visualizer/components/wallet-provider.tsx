"use client"

import type { OneSatContext, WalletInterface } from "@1sat/actions"
import type { OneSatServices } from "@1sat/client"
import dynamic from "next/dynamic"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

const WalletEngine = dynamic(() => import("./wallet-engine"), { ssr: false })

interface WalletAddresses {
  bsvAddress: string | null
}

interface WalletProfile {
  bapId: string | null
  name: string | null
  avatarUrl: string | null
}

type AccountSliceStatus = "idle" | "loading" | "loaded" | "error"

interface AccountLoadState {
  address: AccountSliceStatus
  profile: AccountSliceStatus
}

export interface SendBsvRequest {
  address: string
  satoshis: number
}

export interface SendBsvResult {
  txid?: string
  error?: string
}

export interface WalletState {
  isReady: boolean
  isConnected: boolean
  addresses: WalletAddresses | null
  profile: WalletProfile | null
  accountLoadState: AccountLoadState
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refreshState: () => Promise<void>
  // Routed through the lazily-loaded engine so consumers never import
  // @1sat/actions directly (a value import would pull the whole wallet
  // stack into their page's eager bundle).
  sendBsv: (requests: SendBsvRequest[]) => Promise<SendBsvResult>
  wallet: WalletInterface | null
  ctx: OneSatContext | null
  services: OneSatServices | null
  identityKey: string | null
}

const disconnectedDefaults: WalletState = {
  isReady: false,
  isConnected: false,
  addresses: null,
  profile: null,
  accountLoadState: {
    address: "idle",
    profile: "idle",
  },
  connect: async () => {},
  disconnect: async () => {},
  refreshState: async () => {},
  sendBsv: async () => ({ error: "not-connected" }),
  wallet: null,
  ctx: null,
  services: null,
  identityKey: null,
}

const WalletContext = createContext<WalletState | null>(null)

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [engineState, setEngineState] = useState<WalletState | null>(null)
  const handleEngineState = useCallback((state: WalletState) => {
    setEngineState(state)
  }, [])
  const value = useMemo(
    () => engineState ?? disconnectedDefaults,
    [engineState],
  )

  return (
    <WalletContext.Provider value={value}>
      {children}
      <WalletEngine onState={handleEngineState} />
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletState | null {
  return useContext(WalletContext)
}
