import { NextResponse } from "next/server";
import { getAllSuitesWithBalance, usdToSats } from "@/lib/suites";
import {
  isRedisConfigured,
  wasFundingNotificationSent,
  markFundingNotificationSent,
  setSuiteState,
} from "@/lib/kv";
import {
  sendFundingNotification,
  isNotificationsConfigured,
} from "@/lib/notifications";

// Vercel cron protection - only allow requests with correct authorization
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Check all suites for funding status and send notifications
 * This can be called via Vercel cron or manually with API key
 *
 * GET /api/check-funding
 * Headers: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");

  // Allow if CRON_SECRET matches, or if it's not configured (dev mode)
  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isNotificationsConfigured()) {
    return NextResponse.json(
      {
        error: "Notifications not configured",
        hint: "Set DISCORD_WEBHOOK_URL and/or RESEND_API_KEY + NOTIFICATION_EMAIL",
      },
      { status: 500 }
    );
  }

  try {
    const suites = await getAllSuitesWithBalance();
    const results: Array<{
      suiteId: string;
      name: string;
      funded: boolean;
      notified: boolean;
      newlyNotified: boolean;
    }> = [];

    for (const suite of suites) {
      const goalSats = usdToSats(suite.estimatedCostUsd);
      const isFunded = suite.currentBalanceSats >= goalSats;

      // Check if we already notified for this suite
      let alreadyNotified = false;
      if (isRedisConfigured()) {
        alreadyNotified = await wasFundingNotificationSent(suite.id);
      }

      let newlyNotified = false;

      // If funded and not yet notified, send notification
      if (isFunded && !alreadyNotified && suite.status === "funding") {
        console.log(`[CheckFunding] Suite ${suite.id} is newly funded, sending notification`);

        await sendFundingNotification({
          suiteId: suite.id,
          suiteName: suite.name,
          chain: suite.chain,
          version: suite.version,
          balanceSats: suite.currentBalanceSats,
          balanceUsd: suite.currentBalanceUsd,
          goalUsd: suite.estimatedCostUsd,
        });

        // Mark as notified and update status
        if (isRedisConfigured()) {
          await markFundingNotificationSent(suite.id);
          await setSuiteState(suite.id, {
            lastRunAt: suite.lastRunAt,
            lastRunVersion: suite.lastRunVersion,
            status: "pending",
          });
        }

        newlyNotified = true;
      }

      results.push({
        suiteId: suite.id,
        name: suite.name,
        funded: isFunded,
        notified: alreadyNotified || newlyNotified,
        newlyNotified,
      });
    }

    const newlyFunded = results.filter((r) => r.newlyNotified);

    return NextResponse.json({
      checked: results.length,
      newlyFunded: newlyFunded.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CheckFunding] Error:", error);
    return NextResponse.json(
      { error: "Failed to check funding", details: String(error) },
      { status: 500 }
    );
  }
}
