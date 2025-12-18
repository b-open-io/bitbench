import { Resend } from "resend";

// Environment variables
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL; // Where to send notifications
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bitbench.org";

// Initialize Resend client
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface FundingNotification {
  suiteId: string;
  suiteName: string;
  chain: string;
  version: string;
  balanceSats: number;
  balanceUsd: number;
  goalUsd: number;
}

/**
 * Check if notifications are configured
 */
export function isNotificationsConfigured(): boolean {
  return !!(DISCORD_WEBHOOK_URL || (RESEND_API_KEY && NOTIFICATION_EMAIL));
}

/**
 * Generate the benchmark run command
 */
function getBenchmarkCommand(suiteId: string): string {
  return `cd bench && bun run cli.tsx --suite ${suiteId}`;
}

/**
 * Send Discord webhook notification
 */
async function sendDiscordNotification(
  notification: FundingNotification
): Promise<boolean> {
  if (!DISCORD_WEBHOOK_URL) {
    console.log("[Notifications] Discord webhook not configured");
    return false;
  }

  const command = getBenchmarkCommand(notification.suiteId);

  const embed = {
    title: "🎉 Benchmark Fully Funded!",
    description: `**${notification.suiteName}** has reached its funding goal and is ready to run.`,
    color: 0xf59e0b, // Amber color
    fields: [
      {
        name: "Suite ID",
        value: `\`${notification.suiteId}\``,
        inline: true,
      },
      {
        name: "Chain",
        value: notification.chain.toUpperCase(),
        inline: true,
      },
      {
        name: "Version",
        value: `v${notification.version}`,
        inline: true,
      },
      {
        name: "Funding",
        value: `$${notification.balanceUsd.toFixed(2)} / $${notification.goalUsd.toFixed(2)}`,
        inline: true,
      },
      {
        name: "Balance (sats)",
        value: notification.balanceSats.toLocaleString(),
        inline: true,
      },
      {
        name: "Run Command",
        value: `\`\`\`bash\n${command}\n\`\`\``,
        inline: false,
      },
    ],
    footer: {
      text: "Bitbench - Bitcoin AI Benchmark Platform",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Bitbench",
        avatar_url: `${SITE_URL}/favicon.svg`,
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      console.error(
        "[Notifications] Discord webhook failed:",
        response.status,
        await response.text()
      );
      return false;
    }

    console.log("[Notifications] Discord notification sent successfully");
    return true;
  } catch (error) {
    console.error("[Notifications] Discord webhook error:", error);
    return false;
  }
}

/**
 * Send email notification via Resend
 */
async function sendEmailNotification(
  notification: FundingNotification
): Promise<boolean> {
  if (!resend || !NOTIFICATION_EMAIL) {
    console.log("[Notifications] Resend not configured");
    return false;
  }

  const command = getBenchmarkCommand(notification.suiteId);
  const suiteUrl = `${SITE_URL}/suite/${notification.suiteId}`;

  try {
    const { error } = await resend.emails.send({
      from: "Bitbench <notifications@bitbench.org>",
      to: NOTIFICATION_EMAIL,
      subject: `🎉 Benchmark Funded: ${notification.suiteName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
    .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }
    .meta-item { background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .meta-item .label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .meta-item .value { font-size: 16px; font-weight: 600; color: #111827; }
    .command-box { background: #1f2937; color: #f3f4f6; padding: 16px; border-radius: 8px; font-family: 'Monaco', 'Menlo', monospace; font-size: 14px; overflow-x: auto; margin: 16px 0; }
    .command-box .label { color: #9ca3af; font-size: 12px; margin-bottom: 8px; }
    .command-box code { color: #34d399; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Benchmark Fully Funded!</h1>
  </div>
  <div class="content">
    <p><strong>${notification.suiteName}</strong> has reached its funding goal and is ready to run.</p>

    <div class="meta">
      <div class="meta-item">
        <div class="label">Suite ID</div>
        <div class="value">${notification.suiteId}</div>
      </div>
      <div class="meta-item">
        <div class="label">Chain</div>
        <div class="value">${notification.chain.toUpperCase()}</div>
      </div>
      <div class="meta-item">
        <div class="label">Version</div>
        <div class="value">v${notification.version}</div>
      </div>
      <div class="meta-item">
        <div class="label">Funding</div>
        <div class="value">$${notification.balanceUsd.toFixed(2)} / $${notification.goalUsd.toFixed(2)}</div>
      </div>
    </div>

    <div class="command-box">
      <div class="label">Run this command to execute the benchmark:</div>
      <code>${command}</code>
    </div>

    <p>After the benchmark completes, results will be automatically saved. Make sure to commit and push the updated results.</p>

    <a href="${suiteUrl}" class="button">View Suite Details</a>
  </div>
  <div class="footer">
    <p>Bitbench - Bitcoin AI Benchmark Platform</p>
    <p><a href="${SITE_URL}">${SITE_URL}</a></p>
  </div>
</body>
</html>
      `,
      text: `
Benchmark Fully Funded!

${notification.suiteName} has reached its funding goal and is ready to run.

Suite ID: ${notification.suiteId}
Chain: ${notification.chain.toUpperCase()}
Version: v${notification.version}
Funding: $${notification.balanceUsd.toFixed(2)} / $${notification.goalUsd.toFixed(2)}

Run this command to execute the benchmark:
${command}

After the benchmark completes, results will be automatically saved. Make sure to commit and push the updated results.

View suite: ${suiteUrl}

--
Bitbench - Bitcoin AI Benchmark Platform
${SITE_URL}
      `.trim(),
    });

    if (error) {
      console.error("[Notifications] Resend error:", error);
      return false;
    }

    console.log("[Notifications] Email notification sent successfully");
    return true;
  } catch (error) {
    console.error("[Notifications] Email error:", error);
    return false;
  }
}

/**
 * Send funding notification via all configured channels
 */
export async function sendFundingNotification(
  notification: FundingNotification
): Promise<{ discord: boolean; email: boolean }> {
  console.log(
    `[Notifications] Sending funding notification for ${notification.suiteId}`
  );

  const [discord, email] = await Promise.all([
    sendDiscordNotification(notification),
    sendEmailNotification(notification),
  ]);

  return { discord, email };
}

/**
 * Send a test notification to verify configuration
 */
export async function sendTestNotification(): Promise<{
  discord: boolean;
  email: boolean;
}> {
  const testNotification: FundingNotification = {
    suiteId: "test-suite",
    suiteName: "Test Suite (Ignore)",
    chain: "bsv",
    version: "1.0.0",
    balanceSats: 5_000_000,
    balanceUsd: 2.5,
    goalUsd: 2.5,
  };

  return sendFundingNotification(testNotification);
}
