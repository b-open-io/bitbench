"use client"

import {
  createContext as createOneSatContext,
  deriveDepositAddresses,
  getProfile,
  sendBsv as sendBsvAction,
} from "@1sat/actions"
import { OneSatServices } from "@1sat/client"
import {
  WalletProvider as OneSatWalletProvider,
  useWallet as useOneSatWallet,
} from "@1sat/react"
import { WalletClient } from "@bsv/sdk"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type {
  SendBsvRequest,
  SendBsvResult,
  WalletState,
} from "./wallet-provider"

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

interface WalletEngineProps {
  onState: (state: WalletState) => void
}

// @1sat/react persists the connected provider under this key on a successful
// connect and clears it on disconnect. Its presence means the user connected
// here before, so a silent resume is worth attempting.
const PROVIDER_STORAGE_KEY = "onesat_wallet_provider"

function hasStoredProvider(): boolean {
  try {
    return localStorage.getItem(PROVIDER_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * True when a BRC-100 wallet is present AND already authenticated for this
 * origin (unlocked, recently active, domain whitelisted). Never prompts:
 * substrate probing uses getVersion and isAuthenticated is a silent check —
 * unlike waitForAuthentication, which opens the wallet popup.
 */
async function canResumeSilently(): Promise<boolean> {
  try {
    const probe = new WalletClient("auto")
    await probe.connectToSubstrate()
    const { authenticated } = await probe.isAuthenticated({})
    return authenticated
  } catch {
    return false
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
  const services = useMemo(() => new OneSatServices("main"), [])
  const ctx = useMemo(
    () =>
      status === "connected" && wallet
        ? createOneSatContext(wallet, { chain: "main", services })
        : null,
    [wallet, status, services],
  )

  const [addresses, setAddresses] = useState<WalletAddresses | null>(null)
  const [profile, setProfile] = useState<WalletProfile | null>(null)
  const [accountLoadState, setAccountLoadState] = useState<AccountLoadState>({
    address: "idle",
    profile: "idle",
  })
  const latestIdentityKey = useRef<string | null>(identityKey)
  const latestStatus = useRef(status)

  useEffect(() => {
    latestIdentityKey.current = identityKey
    latestStatus.current = status
  }, [identityKey, status])

  const clearAccountState = useCallback(() => {
    setAddresses(null)
    setProfile(null)
    setAccountLoadState({
      address: "idle",
      profile: "idle",
    })
  }, [])

  const refreshState = useCallback(async () => {
    if (!wallet || !ctx || status !== "connected") {
      clearAccountState()
      return
    }

    const requestIdentityKey = identityKey

    setAccountLoadState({
      address: "loading",
      profile: "loading",
    })

    // No wallet-wide balance fetch here: the BSV "default" basket is
    // admin-only in Yours Wallet (privacy by design), so a dApp cannot read
    // the user's balance. The wallet shows it on the payment prompt instead.
    const [addressResult, profileResult] = await Promise.allSettled([
      deriveDepositAddresses.execute(ctx, { count: 1 }),
      getProfile.execute(ctx, {}),
    ])

    if (latestIdentityKey.current !== requestIdentityKey) return

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
  }, [wallet, ctx, status, identityKey, services, clearAccountState])

  useEffect(() => {
    if (status === "connected") {
      refreshState()
    } else {
      clearAccountState()
    }
  }, [status, refreshState, clearAccountState])

  // Silent session resume. @1sat/react's own autoReconnect goes through
  // waitForAuthentication, which pops the wallet window on every visit when
  // the session grant has lapsed. Instead: resume only when the wallet
  // reports (silently) that this origin is already authenticated; otherwise
  // stay disconnected until the user clicks Connect.
  const resumeAttempted = useRef(false)
  useEffect(() => {
    if (resumeAttempted.current) return
    resumeAttempted.current = true

    if (!hasStoredProvider()) return

    let cancelled = false
    canResumeSilently().then((authenticated) => {
      if (cancelled || !authenticated) return
      if (latestStatus.current !== "disconnected") return
      oneSatConnect().catch((error) => {
        console.error("Silent wallet resume failed:", error)
      })
    })

    return () => {
      cancelled = true
    }
  }, [oneSatConnect])

  useEffect(() => {
    const handler = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action

      if (action === "signedOut") {
        clearAccountState()
        oneSatDisconnect()
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
    } catch (error) {
      console.error("Error disconnecting wallet:", error)
    }
  }, [oneSatDisconnect, clearAccountState])

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
      profile,
      accountLoadState,
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
      profile,
      accountLoadState,
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
  return <OneSatWalletProvider autoDetect>{children}</OneSatWalletProvider>
}

export default function WalletEngine(props: WalletEngineProps) {
  return (
    <WalletEngineProvider>
      <WalletStateEngine {...props} />
    </WalletEngineProvider>
  )
}
