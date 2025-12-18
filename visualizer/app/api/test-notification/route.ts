import { NextResponse } from "next/server";
import {
  sendTestNotification,
  isNotificationsConfigured,
} from "@/lib/notifications";

// Only allow with correct authorization
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Send a test notification to verify configuration
 *
 * POST /api/test-notification
 * Headers: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
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
        configured: {
          discord: !!process.env.DISCORD_WEBHOOK_URL,
          resend: !!process.env.RESEND_API_KEY,
          email: !!process.env.NOTIFICATION_EMAIL,
        },
        hint: "Set DISCORD_WEBHOOK_URL and/or RESEND_API_KEY + NOTIFICATION_EMAIL",
      },
      { status: 500 }
    );
  }

  try {
    const results = await sendTestNotification();

    return NextResponse.json({
      success: results.discord || results.email,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TestNotification] Error:", error);
    return NextResponse.json(
      { error: "Failed to send test notification", details: String(error) },
      { status: 500 }
    );
  }
}
