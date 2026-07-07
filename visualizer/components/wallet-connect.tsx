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

function formatBalance(satoshis: number | null): string {
  if (satoshis === null) return "..."
  const bsv = satoshis / 100_000_000
  return `${bsv.toFixed(4)} BSV`
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
  const themeTokens = walletState?.themeTokens ?? []
  const isLoadingThemes = walletState?.isLoadingThemes ?? false

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
      <Button onClick={handleConnect} variant="outline" className="gap-2">
        <WalletMinimal className="h-4 w-4 fill-current" />
        Connect Wallet
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <WalletMinimal className="h-4 w-4 fill-current" />
          <span className="hidden sm:inline">
            {formatAddress(address || "")}
          </span>
          <span className="text-muted-foreground">
            {formatBalance(balance)}
          </span>
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
                    <ThemeStripes
                      styles={theme.styles}
                      mode={themeState.mode}
                    />
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
  )
}
