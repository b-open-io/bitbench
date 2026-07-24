"use client"

import { Heart, Home, Info, Laptop, Moon, Sun, Trophy } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useState } from "react"
import { GitHubIcon } from "@/components/icons/github-icon"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

/**
 * App-wide command menu. Opens with Cmd/Ctrl+K and offers navigation, theme
 * controls, and external links. Also registers a `d` / Cmd+Shift+D shortcut
 * that toggles dark mode while ignoring text-entry fields.
 */
export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+K toggles the command menu from anywhere.
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }

      // Never hijack keys while the user is typing in a field or editable node.
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return
      }

      // Dark-mode shortcut: a bare `d`, or Cmd/Ctrl+Shift+D.
      const bareD =
        e.key === "d" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey
      const modifiedD =
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "d" || e.key === "D")

      if (bareD || modifiedD) {
        e.preventDefault()
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [resolvedTheme, setTheme])

  const runCommand = useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <Home />
            <span>Home</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/results"))}
          >
            <Trophy />
            <span>Results</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/about"))}>
            <Info />
            <span>About</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runCommand(toggleTheme)}>
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            <span>Toggle theme</span>
            <CommandShortcut>D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
            <Sun />
            <span>Light</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
            <Moon />
            <span>Dark</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
            <Laptop />
            <span>System</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Links">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                window.open(
                  "https://github.com/b-open-io/bitbench",
                  "_blank",
                  "noopener,noreferrer",
                )
              })
            }
          >
            <GitHubIcon />
            <span>GitHub repository</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                window.open(
                  "https://github.com/sponsors/b-open-io",
                  "_blank",
                  "noopener,noreferrer",
                )
              })
            }
          >
            <Heart />
            <span>Become a sponsor</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
