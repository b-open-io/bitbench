import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <p className="font-mono text-sm font-medium uppercase tracking-widest text-muted-foreground">
        404 — Not found
      </p>
      <h1 className="max-w-md text-balance text-3xl font-bold tracking-tight">
        This page ran off the leaderboard
      </h1>
      <p className="max-w-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
        Head back to the benchmarks to keep exploring.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">Back to benchmarks</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/results">View results</Link>
        </Button>
      </div>
    </div>
  )
}
