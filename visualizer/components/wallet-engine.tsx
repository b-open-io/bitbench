"use client"

import {
  createContext as createOneSatContext,
  deriveDepositAddresses,
  getOrdinals,
  getProfile,
  sendBsv as sendBsvAction,
} from "@1sat/actions"
import { OneSatServices } from "@1sat/client"
import {
  WalletProvider as OneSatWalletProvider,
  useWallet as useOneSatWallet,
} from "@1sat/react"
import { type ThemeToken, validateThemeToken } from "@theme-token/sdk"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useThemeToken } from "./theme-provider"
import type {
  SendBsvRequest,
  SendBsvResult,
  WalletState,
} from "./wallet-provider"

interface WalletAddresses {
  bsvAddress: string | null
}

interface WalletBalance {
  satoshis: number
}

interface WalletProfile {
  bapId: string | null
  name: string | null
  avatarUrl: string | null
}

type AccountSliceStatus = "idle" | "loading" | "loaded" | "error"

interface AccountLoadState {
  address: AccountSliceStatus
  balance: AccountSliceStatus
  profile: AccountSliceStatus
}

interface WalletEngineProps {
  onState: (state: WalletState) => void
}

function parseThemeToken(data: Uint8Array): ThemeToken | null {
  try {
    const json = JSON.parse(new TextDecoder().decode(data))
    const result = validateThemeToken(json)
    return result.valid ? result.theme : null
  } catch {
    return null
  }
}

function resolveProfileAvatarUrl(
  image: unknown,
  services: OneSatServices,
): string | null {
  if (typeof image !== "string") return null

  const trimmedImage = image.trim()
  if (!trimmedImage) return null

  if (trimmedImage.startsWith("1sat://")) {
    const outpoint = trimmedImage.slice("1sat://".length)
    return outpoint ? services.ordfs.getContentUrl(outpoint) : null
  }

  if (trimmedImage.startsWith("https://")) return trimmedImage

  return null
}

function WalletStateEngine({ onState }: WalletEngineProps) {
  const {
    wallet,
    status,
    identityKey,
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
  const [profile, setProfile] = useState<WalletProfile | null>(null)
  const [accountLoadState, setAccountLoadState] = useState<AccountLoadState>({
    address: "idle",
    balance: "idle",
    profile: "idle",
  })
  const [themeTokens, setThemeTokens] = useState<ThemeToken[]>([])
  const [isLoadingThemes, setIsLoadingThemes] = useState(false)
  const latestIdentityKey = useRef<string | null>(identityKey)
  const latestStatus = useRef(status)

  useEffect(() => {
    latestIdentityKey.current = identityKey
    latestStatus.current = status
  }, [identityKey, status])

  const clearAccountState = useCallback(() => {
    setAddresses(null)
    setBalance(null)
    setProfile(null)
    setAccountLoadState({
      address: "idle",
      balance: "idle",
      profile: "idle",
    })
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

    setAccountLoadState({
      address: "loading",
      balance: "loading",
      profile: "loading",
    })

    const [balanceResult, addressResult, profileResult] =
      await Promise.allSettled([
        wallet.listOutputs({ basket: "default", limit: 10000 }),
        deriveDepositAddresses.execute(ctx, { count: 1 }),
        getProfile.execute(ctx, {}),
      ])

    if (latestIdentityKey.current !== requestIdentityKey) return

    if (balanceResult.status === "fulfilled") {
      const satoshis = balanceResult.value.outputs.reduce(
        (sum, output) => sum + output.satoshis,
        0,
      )
      setBalance({ satoshis })
      setAccountLoadState((current) => ({ ...current, balance: "loaded" }))
    } else {
      console.error("listOutputs failed:", balanceResult.reason)
      setAccountLoadState((current) => ({ ...current, balance: "error" }))
    }

    if (addressResult.status === "fulfilled") {
      setAddresses({
        bsvAddress: addressResult.value.derivations[0]?.address ?? null,
      })
      setAccountLoadState((current) => ({ ...current, address: "loaded" }))
    } else {
      console.error("deriveDepositAddresses failed:", addressResult.reason)
      setAccountLoadState((current) => ({ ...current, address: "error" }))
    }

    if (profileResult.status === "fulfilled") {
      if (profileResult.value.error) {
        console.error("getProfile failed:", profileResult.value.error)
        setAccountLoadState((current) => ({ ...current, profile: "error" }))
      } else {
        const profileData = profileResult.value.profile
        const name =
          typeof profileData?.name === "string" ? profileData.name : null
        setProfile({
          bapId: profileResult.value.bapId ?? null,
          name,
          avatarUrl: resolveProfileAvatarUrl(profileData?.image, services),
        })
        setAccountLoadState((current) => ({ ...current, profile: "loaded" }))
      }
    } else {
      console.error("getProfile failed:", profileResult.reason)
      setAccountLoadState((current) => ({ ...current, profile: "error" }))
    }

    await fetchThemeTokens()
  }, [
    wallet,
    ctx,
    status,
    identityKey,
    services,
    clearAccountState,
    fetchThemeTokens,
  ])

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

  // BRC-100 extension detection only happens INSIDE oneSatConnect()
  // (availableProviders lists configured providers, never detected
  // extensions). connect() resolves with status "selecting" when nothing
  // was found; a fast failure means no wallet is installed, while a slow
  // one is a user rejection -- only the former should route to yours.org.
  const connect = useCallback(async () => {
    const startedAt = Date.now()
    try {
      await oneSatConnect()
    } catch (error) {
      console.error("Error connecting wallet:", error)
      return
    }

    if (latestStatus.current !== "connected" && Date.now() - startedAt < 2000) {
      window.open("https://yours.org", "_blank")
    }
  }, [oneSatConnect])

  const disconnect = useCallback(async () => {
    try {
      oneSatDisconnect()
      clearAccountState()
      themeContext.resetTheme()
    } catch (error) {
      console.error("Error disconnecting wallet:", error)
    }
  }, [oneSatDisconnect, clearAccountState, themeContext])

  const sendBsv = useCallback(
    async (requests: SendBsvRequest[]): Promise<SendBsvResult> => {
      if (!ctx) return { error: "not-connected" }
      const result = await sendBsvAction.execute(ctx, { requests })
      return { txid: result.txid, error: result.error }
    },
    [ctx],
  )

  const state = useMemo<WalletState>(
    () => ({
      isReady: true,
      isConnected: status === "connected",
      addresses,
      balance,
      profile,
      accountLoadState,
      themeTokens,
      isLoadingThemes,
      connect,
      disconnect,
      refreshState,
      sendBsv,
      wallet,
      ctx,
      services,
      identityKey,
    }),
    [
      status,
      addresses,
      balance,
      profile,
      accountLoadState,
      themeTokens,
      isLoadingThemes,
      connect,
      disconnect,
      refreshState,
      sendBsv,
      wallet,
      ctx,
      services,
      identityKey,
    ],
  )

  useEffect(() => {
    onState(state)
  }, [state, onState])

  return null
}

function WalletEngineProvider({ children }: { children: ReactNode }) {
  return (
    <OneSatWalletProvider autoDetect autoReconnect>
      {children}
    </OneSatWalletProvider>
  )
}

export default function WalletEngine(props: WalletEngineProps) {
  return (
    <WalletEngineProvider>
      <WalletStateEngine {...props} />
    </WalletEngineProvider>
  )
}
