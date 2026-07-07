import { NextResponse } from "next/server"
import {
  isRedisConfigured,
  markFundingNotificationSent,
  setSuiteState,
  wasFundingNotificationSent,
} from "@/lib/kv"
import {
  isNotificationsConfigured,
  sendFundingNotification,
} from "@/lib/notifications"
import { getBsvPriceUsd } from "@/lib/price"
import { listRunRequests, setRunRequestStatus } from "@/lib/run-requests"
import {
  getAddressBalance,
  getAllSuitesWithBalance,
  satsToUsd,
  usdToSats,
} from "@/lib/suites"

// Vercel cron protection - only allow requests with correct authorization
const CRON_SECRET = process.env.CRON_SECRET

/**
 * Check all suites for funding status and send notifications
 * This can be called via Vercel cron or manually with API key
 *
 * GET /api/check-funding
 * Headers: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get("authorization")
  const providedSecret = authHeader?.replace("Bearer ", "")

  // Allow if CRON_SECRET matches, or if it's not configured (dev mode)
  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isNotificationsConfigured()) {
    return NextResponse.json(
      {
        error: "Notifications not configured",
        hint: "Set DISCORD_WEBHOOK_URL and/or RESEND_API_KEY + NOTIFICATION_EMAIL",
      },
      { status: 500 },
    )
  }

  try {
    const suites = await getAllSuitesWithBalance()
    const results: Array<{
      suiteId: string
      name: string
      funded: boolean
      notified: boolean
      newlyNotified: boolean
    }> = []
    const runRequestResults: Array<{
      requestId: string
      suiteId: string
      modelCount: number
      funded: boolean
      newlyPending: boolean
    }> = []

    for (const suite of suites) {
      const goalSats = usdToSats(suite.estimatedCostUsd, suite.bsvPriceUsd)
      const isFunded = suite.currentBalanceSats >= goalSats

      // Check if we already notified for this suite
      let alreadyNotified = false
      if (isRedisConfigured()) {
        alreadyNotified = await wasFundingNotificationSent(suite.id)
      }

      let newlyNotified = false

      // If funded and not yet notified, send notification
      if (isFunded && !alreadyNotified && suite.status === "funding") {
        console.log(
          `[CheckFunding] Suite ${suite.id} is newly funded, sending notification`,
        )

        await sendFundingNotification({
          suiteId: suite.id,
          suiteName: suite.name,
          chain: suite.chain,
          version: suite.version,
          balanceSats: suite.currentBalanceSats,
          balanceUsd: suite.currentBalanceUsd,
          goalUsd: suite.estimatedCostUsd,
        })

        // Mark as notified and update status
        if (isRedisConfigured()) {
          await markFundingNotificationSent(suite.id)
          await setSuiteState(suite.id, {
            lastRunAt: suite.lastRunAt,
            lastRunVersion: suite.lastRunVersion,
            status: "pending",
          })
        }

        newlyNotified = true
      }

      results.push({
        suiteId: suite.id,
        name: suite.name,
        funded: isFunded,
        notified: alreadyNotified || newlyNotified,
        newlyNotified,
      })
    }

    const bsvPriceUsd = await getBsvPriceUsd()
    const suiteById = new Map(suites.map((suite) => [suite.id, suite]))
    const runRequests = await listRunRequests()

    for (const runRequest of runRequests.filter(
      (request) => request.status === "funding",
    )) {
      const suite = suiteById.get(runRequest.suiteId)
      if (!suite) continue

      const balanceSats = await getAddressBalance(runRequest.donationAddress)
      const balanceUsd = satsToUsd(balanceSats, bsvPriceUsd)
      const goalSats = usdToSats(runRequest.estimatedCostUsd, bsvPriceUsd)
      const isFunded = balanceSats >= goalSats
      let newlyPending = false

      if (isFunded) {
        await sendFundingNotification({
          suiteId: suite.id,
          suiteName: suite.name,
          chain: suite.chain,
          version: runRequest.suiteVersion,
          balanceSats,
          balanceUsd,
          goalUsd: runRequest.estimatedCostUsd,
          requestId: runRequest.requestId,
          modelCount: runRequest.modelCount,
        })
        await setRunRequestStatus(runRequest.requestId, "pending")
        newlyPending = true
      }

      runRequestResults.push({
        requestId: runRequest.requestId,
        suiteId: runRequest.suiteId,
        modelCount: runRequest.modelCount,
        funded: isFunded,
        newlyPending,
      })
    }

    const newlyFunded = results.filter((r) => r.newlyNotified)

    return NextResponse.json({
      checked: results.length,
      newlyFunded: newlyFunded.length,
      results,
      runRequests: {
        checked: runRequestResults.length,
        newlyPending: runRequestResults.filter((r) => r.newlyPending).length,
        results: runRequestResults,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[CheckFunding] Error:", error)
    return NextResponse.json(
      { error: "Failed to check funding", details: String(error) },
      { status: 500 },
    )
  }
}
