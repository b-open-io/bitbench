import { NextResponse } from "next/server"
import { getBsvPriceUsd } from "@/lib/price"
import { createRunRequest, listRunRequests } from "@/lib/run-requests"
import { getAddressBalance, satsToUsd, usdToSats } from "@/lib/suites"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface RouteParams {
  params: Promise<{ id: string }>
}

async function withBalances(suiteId: string) {
  const [requests, bsvPriceUsd] = await Promise.all([
    listRunRequests(suiteId),
    getBsvPriceUsd(),
  ])

  return Promise.all(
    requests.map(async (request) => {
      const currentBalanceSats = await getAddressBalance(
        request.donationAddress,
      )
      const currentBalanceUsd = satsToUsd(currentBalanceSats, bsvPriceUsd)
      const goalSats = usdToSats(request.estimatedCostUsd, bsvPriceUsd)

      return {
        ...request,
        currentBalanceSats,
        currentBalanceUsd,
        bsvPriceUsd,
        fundingProgress:
          goalSats > 0 ? Math.min(currentBalanceSats / goalSats, 1) : 0,
      }
    }),
  )
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params

  let body: { modelIds?: unknown }
  try {
    body = (await request.json()) as { modelIds?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.modelIds)) {
    return NextResponse.json(
      { error: "Body must include modelIds: string[]" },
      { status: 400 },
    )
  }

  if (!body.modelIds.every((modelId) => typeof modelId === "string")) {
    return NextResponse.json(
      { error: "Every model id must be a string" },
      { status: 400 },
    )
  }

  try {
    const runRequest = await createRunRequest(id, body.modelIds)
    return NextResponse.json(runRequest)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    )
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params

  try {
    return NextResponse.json({ requests: await withBalances(id) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
