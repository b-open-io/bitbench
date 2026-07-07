import { NextResponse } from "next/server"
import { listRunRequests } from "@/lib/run-requests"
import type { RunRequestStatus } from "@/lib/types"

export const dynamic = "force-dynamic"
export const revalidate = 0

const STATUS_VALUES = new Set<RunRequestStatus>([
  "funding",
  "pending",
  "completed",
])

export async function GET(request: Request) {
  const url = new URL(request.url)
  const status = url.searchParams.get("status")

  if (status !== null && !STATUS_VALUES.has(status as RunRequestStatus)) {
    return NextResponse.json(
      { error: "status must be funding, pending, or completed" },
      { status: 400 },
    )
  }

  try {
    const requests = await listRunRequests()
    const filtered = status
      ? requests.filter((runRequest) => runRequest.status === status)
      : requests

    return NextResponse.json({ requests: filtered })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
