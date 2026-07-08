"use client"

import type { ThemeToken } from "@theme-token/sdk"
import {
  CircleCheck,
  Files,
  History,
  LoaderCircle,
  PaintBucket,
  Power,
  WalletMinimal,
} from "lucide-react"
import { type MouseEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useThemeToken } from "./theme-provider"
import { useWallet } from "./wallet-provider"

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatBalance(satoshis: number): string {
  const bsv = satoshis / 100_000_000
  return `${bsv.toFixed(4)} BSV`
}

function LoadingSkeleton({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded bg-muted ${className}`}
    />
  )
}

function WalletAvatar({
  avatarUrl,
  name,
  size,
}: {
  avatarUrl: string | null
  name: string | null
  size: "sm" | "md"
}) {
  const sizeClass = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm"
  const iconSizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
  const initial = name?.trim().charAt(0).toUpperCase()

  if (avatarUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: ORDFS avatar URLs are remote; the wallet spec avoids next/image config changes.
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    )
  }

  return (
    <span
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground`}
    >
      {initial || <WalletMinimal className={`${iconSizeClass} fill-current`} />}
    </span>
  )
}

// Visual representation of theme colors
function ThemeStripes({
  styles,
  mode,
}: {
  styles: { light: Record<string, string>; dark: Record<string, string> }
  mode: "light" | "dark"
}) {
  const colors = [
    ["primary", styles[mode].primary],
    ["secondary", styles[mode].secondary],
    ["accent", styles[mode].accent],
    ["background", styles[mode].background],
  ] as const

  return (
    <div className="flex h-4 w-8 overflow-hidden rounded border border-border">
      {colors.map(([slot, color]) => (
        <div key={slot} className="flex-1" style={{ backgroundColor: color }} />
      ))}
    </div>
  )
}

export function WalletConnect() {
  const walletState = useWallet()
  const themeState = useThemeToken()
  const [copied, setCopied] = useState(false)

  const isConnected = walletState?.isConnected ?? false
  const address = walletState?.addresses?.bsvAddress ?? null
  const balance = walletState?.balance?.satoshis ?? null
  const profile = walletState?.profile ?? null
  const accountLoadState = walletState?.accountLoadState ?? {
    address: "idle",
    balance: "idle",
    profile: "idle",
  }
  const themeTokens = walletState?.themeTokens ?? []
  const isLoadingThemes = walletState?.isLoadingThemes ?? false
  const displayName = profile?.name?.trim() || null
  const triggerLabel = displayName ?? (address ? formatAddress(address) : null)
  const isProfileLoading =
    accountLoadState.profile === "loading" && profile === null
  const isProfileUnavailable =
    accountLoadState.profile === "error" && profile === null
  const isAddressLoading =
    accountLoadState.address === "loading" && address === null
  const isBalanceUnavailable = accountLoadState.balance === "error"
  const showBalance = !isBalanceUnavailable

  const handleConnect = async () => {
    await walletState?.connect()
  }

  const handleDisconnect = async () => {
    await walletState?.disconnect()
  }

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSelectTheme = (theme: ThemeToken, e: MouseEvent) => {
    themeState.applyThemeAnimated(theme, e)
  }

  const handleResetTheme = () => {
    themeState.resetTheme()
  }

  if (!isConnected) {
    return (
      <Button
        onClick={handleConnect}
        variant="outline"
        aria-label="Connect wallet"
        className="gap-2 px-2.5 sm:px-3"
      >
        <WalletMinimal className="h-4 w-4 fill-current" />
        <span className="hidden sm:inline">Connect</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-0 gap-2 px-2 sm:px-3">
          <WalletAvatar
            avatarUrl={profile?.avatarUrl ?? null}
            name={displayName}
            size="sm"
          />
          {triggerLabel ? (
            <span className="hidden max-w-28 truncate sm:inline">
              {triggerLabel}
            </span>
          ) : (
            <LoadingSkeleton className="hidden h-4 w-16 sm:block" />
          )}
          {showBalance &&
            (balance === null ? (
              <LoadingSkeleton className="h-4 w-14" />
            ) : (
              <span className="text-muted-foreground">
                {formatBalance(balance)}
              </span>
            ))}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="px-2 py-1.5 font-normal">
          <div className="flex items-center gap-2">
            <WalletAvatar
              avatarUrl={profile?.avatarUrl ?? null}
              name={displayName}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isProfileLoading ? (
                  <LoadingSkeleton className="h-4 w-24" />
                ) : (
                  <span className="truncate font-medium">
                    {displayName ??
                      (isProfileUnavailable
                        ? "Identity unavailable"
                        : "Anonymous")}
                  </span>
                )}
                {profile?.bapId && (
                  <span className="rounded bg-primary/10 px-1 text-[10px] uppercase text-primary">
                    BAP
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {address ? (
                  formatAddress(address)
                ) : isAddressLoading ? (
                  <LoadingSkeleton className="h-3 w-24" />
                ) : (
                  "Address unavailable"
                )}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {showBalance && (
          <>
            <DropdownMenuLabel className="flex justify-between px-2 py-1.5 font-normal text-sm">
              <span>Balance</span>
              {balance === null ? (
                <LoadingSkeleton className="h-4 w-20" />
              ) : (
                <span className="text-muted-foreground">
                  {formatBalance(balance)}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem
          onClick={copyAddress}
          disabled={!address}
          className="gap-2"
        >
          {copied ? (
            <CircleCheck className="h-4 w-4 fill-current" />
          ) : (
            <Files className="h-4 w-4 fill-current" />
          )}
          {copied ? "Copied!" : "Copy Address"}
        </DropdownMenuItem>

        {themeTokens.length > 0 && (
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
        )}

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
  )
}
