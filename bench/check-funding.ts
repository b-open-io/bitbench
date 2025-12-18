#!/usr/bin/env bun
/**
 * Simple CLI script to check funding status for all test suites.
 * Run with: bun run funding
 */

import { getAllFundingStatus, formatFundingRow, isMasterWifConfigured } from "./funding";

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════════════════╗");
  console.log("║                        BITBENCH FUNDING STATUS                        ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════╝\n");

  if (!isMasterWifConfigured()) {
    console.log("⚠️  MASTER_WIF not set. Add to .env to see funding addresses.\n");
  }

  console.log("Checking balances via WhatsOnChain...\n");

  const statuses = await getAllFundingStatus();
  const rows = statuses.map(formatFundingRow);

  // Calculate column widths
  const widths = {
    name: Math.max(10, ...rows.map((r) => r.name.length)),
    tests: 5,
    address: Math.max(16, ...rows.map((r) => r.address.length)),
    balance: 10,
    goal: 8,
    progress: 10,
    funded: 8,
  };

  // Print header
  const header = [
    "Suite".padEnd(widths.name),
    "Tests".padStart(widths.tests),
    "Address".padEnd(widths.address),
    "Raised".padStart(widths.balance),
    "Goal".padStart(widths.goal),
    "Progress".padStart(widths.progress),
    "Funded".padEnd(widths.funded),
  ].join("  ");

  console.log(`\x1b[4m${header}\x1b[0m`);

  // Print rows
  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const row = rows[i];

    const progressBar = createProgressBar(status.fundingProgress, 8);
    const fundedColor = status.isFunded ? "\x1b[32m" : "\x1b[31m";
    const balanceColor = status.fundingProgress >= 1 ? "\x1b[32m" : "\x1b[33m";

    const line = [
      row.name.padEnd(widths.name),
      row.tests.padStart(widths.tests),
      row.address.padEnd(widths.address),
      `${balanceColor}${row.balance.padStart(widths.balance)}\x1b[0m`,
      row.goal.padStart(widths.goal),
      progressBar,
      `${fundedColor}${row.funded.padEnd(widths.funded)}\x1b[0m`,
    ].join("  ");

    console.log(line);
  }

  // Summary
  const totalRaised = statuses.reduce((sum, s) => sum + s.balanceUsd, 0);
  const totalGoal = statuses.reduce((sum, s) => sum + s.goalUsd, 0);
  const fundedCount = statuses.filter((s) => s.isFunded).length;

  console.log("\n────────────────────────────────────────────────────────");
  console.log(
    `Summary: \x1b[32m$${totalRaised.toFixed(2)}\x1b[0m / $${totalGoal.toFixed(2)} raised  •  ` +
    `${fundedCount > 0 ? "\x1b[32m" : "\x1b[33m"}${fundedCount}\x1b[0m/${statuses.length} suites funded`
  );
  console.log("");
}

function createProgressBar(progress: number, width: number): string {
  const filled = Math.round(width * progress);
  const empty = width - filled;
  const color = progress >= 1 ? "\x1b[32m" : progress >= 0.5 ? "\x1b[33m" : "\x1b[31m";
  return `${color}${"█".repeat(filled)}\x1b[90m${"░".repeat(empty)}\x1b[0m`;
}

main().catch(console.error);
