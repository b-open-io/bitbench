"use client"

import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ModelRegistryEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ModelsDialogProps {
  modelCount: number
  className?: string
}

interface ModelsResponse {
  count: number
  models: ModelRegistryEntry[]
}

function groupModelsByLab(models: ModelRegistryEntry[]) {
  return models.reduce<Record<string, ModelRegistryEntry[]>>(
    (groups, model) => {
      const lab = model.id.split("/")[0] || "unknown"
      groups[lab] ??= []
      groups[lab].push(model)
      return groups
    },
    {},
  )
}

export function ModelsDialog({ modelCount, className }: ModelsDialogProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ModelsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch once on first open. Depends ONLY on `open` — including `loading`
  // or `data` here would self-cancel: setLoading(true) retriggers the
  // effect, whose cleanup aborts the in-flight fetch, hanging the spinner
  // forever. A ref guards against a duplicate fetch across re-opens.
  const fetchedRef = useRef(false)
  useEffect(() => {
    if (!open || fetchedRef.current) return
    fetchedRef.current = true
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch("/api/models")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load model registry")
        return (await response.json()) as ModelsResponse
      })
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) {
          fetchedRef.current = false
          setError(err instanceof Error ? err.message : "Failed to load models")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const groupedModels = useMemo(() => {
    if (!data) return []
    return Object.entries(groupModelsByLab(data.models)).sort(([a], [b]) =>
      a.localeCompare(b),
    )
  }, [data])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hidden items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-normal text-muted-foreground transition-colors hover:bg-accent md:flex cursor-pointer",
          className,
        )}
      >
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        {modelCount} models
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl flex flex-col">
          <DialogHeader>
            <DialogTitle>Current Model Registry</DialogTitle>
            <DialogDescription>
              {(data?.count ?? modelCount).toLocaleString()} models resolved
              from the OpenRouter catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto pr-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="py-8 text-sm text-destructive">{error}</p>
            ) : (
              <div className="space-y-5">
                {groupedModels.map(([lab, models]) => (
                  <section key={lab} className="space-y-2">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground">
                      {lab}
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                      {models.map((model) => (
                        <span
                          key={model.id}
                          className="break-words font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]"
                        >
                          {model.name}
                        </span>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
