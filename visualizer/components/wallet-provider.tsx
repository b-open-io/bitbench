"use client"

import {
  createContext as createOneSatContext,
  deriveDepositAddresses,
  getOrdinals,
  type OneSatContext,
  type WalletInterface,
} from "@1sat/actions"
import { OneSatServices } from "@1sat/client"
import {
  WalletProvider as OneSatWalletProvider,
  useWallet as useOneSatWallet,
} from "@1sat/react"
import { type ThemeToken, validateThemeToken } from "@theme-token/sdk"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useThemeToken } from "./theme-provider"

interface WalletAddresses {
  bsvAddress: string | null
}

interface WalletBalance {
  satoshis: number
}

interface WalletState {
  isReady: boolean
  isConnected: boolean
  addresses: WalletAddresses | null
  balance: WalletBalance | null
  themeTokens: ThemeToken[]
  isLoadingThemes: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refreshState: () => Promise<void>
  wallet: WalletInterface | null
  ctx: OneSatContext | null
  services: OneSatServices
  identityKey: string | null
}

const WalletContext = createContext<WalletState | null>(null)

function parseThemeToken(data: Uint8Array): ThemeToken | null {
  try {
    const json = JSON.parse(new TextDecoder().decode(data))
    const result = validateThemeToken(json)
    return result.valid ? result.theme : null
  } catch {
    return null
  }
}

function WalletStateProvider({ children }: { children: ReactNode }) {
  const {
    wallet,
    status,
    identityKey,
    availableProviders,
    connect: oneSatConnect,
    disconnect: oneSatDisconnect,
  } = useOneSatWallet()
  const themeContext = useThemeToken()
  const services = useMemo(() => new OneSatServices("main"), [])
  const ctx = useMemo(
    () =>
      status === "connected" && wallet
        ? createOneSatContext(wallet, { chain: "main", services })
        : null,
    [wallet, status, services],
  )

  const [addresses, setAddresses] = useState<WalletAddresses | null>(null)
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [themeTokens, setThemeTokens] = useState<ThemeToken[]>([])
  const [isLoadingThemes, setIsLoadingThemes] = useState(false)
  const latestIdentityKey = useRef<string | null>(identityKey)

  useEffect(() => {
    latestIdentityKey.current = identityKey
  }, [identityKey])

  const clearAccountState = useCallback(() => {
    setAddresses(null)
    setBalance(null)
    setThemeTokens([])
    setIsLoadingThemes(false)
    themeContext.setAvailableThemes([])
  }, [themeContext])

  const fetchThemeTokens = useCallback(async () => {
    if (!ctx) {
      setThemeTokens([])
      themeContext.setAvailableThemes([])
      return
    }

    const requestIdentityKey = identityKey
    setIsLoadingThemes(true)

    try {
      const { outputs } = await getOrdinals.execute(ctx, { limit: 100 })
      const outpoints = outputs.map((output) => output.outpoint).filter(Boolean)
      if (outpoints.length === 0) {
        if (latestIdentityKey.current === requestIdentityKey) {
          setThemeTokens([])
          themeContext.setAvailableThemes([])
        }
        return
      }

      const metadata = await services.ordfs.bulkMetadata(outpoints)
      const themeOutputs = outputs.filter(
        (output) => metadata[output.outpoint]?.map?.type === "theme",
      )
      const tokens: ThemeToken[] = []

      for (const output of themeOutputs) {
        try {
          const { data } = await services.ordfs.getContent(output.outpoint)
          const token = parseThemeToken(data)
          if (token) tokens.push(token)
        } catch {
          // Skip invalid or unavailable theme ordinals.
        }
      }

      if (latestIdentityKey.current === requestIdentityKey) {
        setThemeTokens(tokens)
        themeContext.setAvailableThemes(tokens)
      }
    } catch (error) {
      console.error("Error fetching theme tokens:", error)
    } finally {
      if (latestIdentityKey.current === requestIdentityKey) {
        setIsLoadingThemes(false)
      }
    }
  }, [ctx, identityKey, services, themeContext])

  const refreshState = useCallback(async () => {
    if (!wallet || !ctx || status !== "connected") {
      clearAccountState()
      return
    }

    const requestIdentityKey = identityKey

    try {
      const [{ outputs }, { derivations }] = await Promise.all([
        wallet.listOutputs({ basket: "default", limit: 10000 }),
        deriveDepositAddresses.execute(ctx, { count: 1 }),
      ])
      const satoshis = outputs.reduce((sum, output) => sum + output.satoshis, 0)
      const bsvAddress = derivations[0]?.address ?? null

      if (latestIdentityKey.current !== requestIdentityKey) return

      setBalance({ satoshis })
      setAddresses({ bsvAddress })
      await fetchThemeTokens()
    } catch (error) {
      console.error("Error refreshing wallet state:", error)
      if (latestIdentityKey.current === requestIdentityKey) {
        clearAccountState()
      }
    }
  }, [wallet, ctx, status, identityKey, clearAccountState, fetchThemeTokens])

  useEffect(() => {
    if (status === "connected") {
      refreshState()
    } else {
      clearAccountState()
    }
  }, [status, refreshState, clearAccountState])

  useEffect(() => {
    const handler = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action

      if (action === "signedOut") {
        clearAccountState()
        return
      }

      if (action === "switchAccount") {
        clearAccountState()
        oneSatDisconnect()
        window.setTimeout(() => {
          oneSatConnect().catch((error) => {
            console.error("Error reconnecting wallet:", error)
          })
        }, 500)
      }
    }

    window.addEventListener("YoursEmitEvent", handler)
    return () => window.removeEventListener("YoursEmitEvent", handler)
  }, [clearAccountState, oneSatConnect, oneSatDisconnect])

  const connect = useCallback(async () => {
    if (availableProviders.length === 0) {
      window.open("https://yours.org", "_blank")
      return
    }

    try {
      await oneSatConnect()
      await refreshState()
    } catch (error) {
      console.error("Error connecting wallet:", error)
    }
  }, [availableProviders.length, oneSatConnect, refreshState])

  const disconnect = useCallback(async () => {
    try {
      oneSatDisconnect()
      clearAccountState()
      themeContext.resetTheme()
    } catch (error) {
      console.error("Error disconnecting wallet:", error)
    }
  }, [oneSatDisconnect, clearAccountState, themeContext])

  const state: WalletState = {
    isReady: availableProviders.length > 0,
    isConnected: status === "connected",
    addresses,
    balance,
    themeTokens,
    isLoadingThemes,
    connect,
    disconnect,
    refreshState,
    wallet,
    ctx,
    services,
    identityKey,
  }

  return (
    <WalletContext.Provider value={state}>{children}</WalletContext.Provider>
  )
}

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <OneSatWalletProvider autoDetect autoReconnect>
      <WalletStateProvider>{children}</WalletStateProvider>
    </OneSatWalletProvider>
  )
}

export function useWallet(): WalletState | null {
  return useContext(WalletContext)
}
