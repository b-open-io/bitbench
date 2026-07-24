"use client"

import { RotateCw } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the failure for observability; the UI stays recoverable below.
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <p className="font-mono text-sm font-medium uppercase tracking-widest text-destructive">
        Something went wrong
      </p>
      <h1 className="max-w-md text-balance text-3xl font-bold tracking-tight">
        This view hit an unexpected error
      </h1>
      <p className="max-w-sm text-muted-foreground">
        The page couldn&apos;t finish loading. You can try again, or head back
        to the benchmarks.
      </p>
      {error.digest ? (
        <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          Ref: {error.digest}
        </code>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()}>
          <RotateCw data-icon="inline-start" className="h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <a href="/">Back to benchmarks</a>
        </Button>
      </div>
    </div>
  )
}
