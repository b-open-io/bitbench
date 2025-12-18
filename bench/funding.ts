/**
 * Funding module for checking suite donation status
 * Uses Type 42 key derivation (same as visualizer) and WhatsOnChain for balances
 */

import { PrivateKey } from "@bsv/sdk";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readdir, readFile } from "fs/promises";

// Model count constant
const MODEL_COUNT = 44;

// WhatsOnChain API for balance checking
const WOC_API = "https://api.whatsonchain.com/v1/bsv/main";

// Current BSV price estimate (same as visualizer)
const BSV_PRICE_USD = 50;

export interface FundingStatus {
  suiteId: string;
  suiteName: string;
  address: string;
  balanceSats: number;
  balanceUsd: number;
  goalSats: number;
  goalUsd: number;
  fundingProgress: number; // 0-1
  isFunded: boolean;
  testCount: number;
}

/**
 * Derive donation address using Type 42 (mirrors visualizer/lib/addresses.ts)
 */
export function getDonationAddress(suiteId: string): string {
  const masterWif = process.env.MASTER_WIF;
  if (!masterWif) {
    throw new Error(
      "MASTER_WIF environment variable is not set. Add it to bench/.env"
    );
  }

  const masterKey = PrivateKey.fromWif(masterWif);
  const selfPubKey = masterKey.toPublicKey();
  const derivedKey = masterKey.deriveChild(selfPubKey, suiteId);

  return derivedKey.toAddress().toString();
}

/**
 * Check if MASTER_WIF is configured
 */
export function isMasterWifConfigured(): boolean {
  return !!process.env.MASTER_WIF;
}

/**
 * Convert satoshis to USD
 */
export function satsToUsd(sats: number): number {
  return (sats / 100_000_000) * BSV_PRICE_USD;
}

/**
 * Convert USD to satoshis
 */
export function usdToSats(usd: number): number {
  return Math.ceil((usd / BSV_PRICE_USD) * 100_000_000);
}

/**
 * Get balance for a BSV address from WhatsOnChain
 */
export async function getAddressBalance(address: string): Promise<number> {
  try {
    const res = await fetch(`${WOC_API}/address/${address}/balance`);
    if (!res.ok) {
      console.error(`WOC balance check failed: ${res.status}`);
      return 0;
    }
    const data = (await res.json()) as { confirmed: number; unconfirmed: number };
    return data.confirmed + data.unconfirmed;
  } catch (error) {
    console.error("Failed to fetch balance:", error);
    return 0;
  }
}

/**
 * Get suite ID from filename (e.g., "bitcoin-protocols.json" -> "bitcoin-protocols")
 */
function getSuiteIdFromFilename(filename: string): string {
  return filename.replace(".json", "");
}

/**
 * Load all test suites from tests/ directory
 */
export async function loadTestSuites(): Promise<
  Array<{ id: string; name: string; testCount: number; estimatedCostUsd: number; filePath: string }>
> {
  const here = fileURLToPath(import.meta.url);
  const testsDir = join(dirname(here), "tests");

  const entries = await readdir(testsDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));

  const suites: Array<{
    id: string;
    name: string;
    testCount: number;
    estimatedCostUsd: number;
    filePath: string;
  }> = [];

  for (const f of files) {
    try {
      const filePath = join(testsDir, f.name);
      const raw = await readFile(filePath, "utf-8");
      const json = JSON.parse(raw);
      if (json && json.name && Array.isArray(json.tests)) {
        suites.push({
          id: getSuiteIdFromFilename(f.name),
          name: json.name,
          testCount: json.tests.length,
          estimatedCostUsd: json.estimatedCostUsd ?? 29,
          filePath,
        });
      }
    } catch {
      // Skip invalid files
    }
  }

  return suites;
}

/**
 * Get funding status for a single suite
 */
export async function getSuiteFundingStatus(
  suiteId: string,
  suiteName: string,
  testCount: number,
  estimatedCostUsd: number
): Promise<FundingStatus> {
  let address: string;
  try {
    address = getDonationAddress(suiteId);
  } catch {
    address = `(no MASTER_WIF)`;
  }

  const balanceSats =
    address.startsWith("(") ? 0 : await getAddressBalance(address);
  const balanceUsd = satsToUsd(balanceSats);
  const goalSats = usdToSats(estimatedCostUsd);
  const goalUsd = estimatedCostUsd;
  const fundingProgress = goalSats > 0 ? Math.min(balanceSats / goalSats, 1) : 0;

  return {
    suiteId,
    suiteName,
    address,
    balanceSats,
    balanceUsd,
    goalSats,
    goalUsd,
    fundingProgress,
    isFunded: fundingProgress >= 1,
    testCount,
  };
}

/**
 * Get funding status for all suites
 */
export async function getAllFundingStatus(): Promise<FundingStatus[]> {
  const suites = await loadTestSuites();

  // Fetch balances in parallel
  const statuses = await Promise.all(
    suites.map((suite) =>
      getSuiteFundingStatus(suite.id, suite.name, suite.testCount, suite.estimatedCostUsd)
    )
  );

  return statuses;
}

/**
 * Format a funding status row for terminal display
 */
export function formatFundingRow(status: FundingStatus): {
  name: string;
  tests: string;
  address: string;
  balance: string;
  goal: string;
  progress: string;
  progressPct: number;
  funded: string;
} {
  const progressPct = Math.round(status.fundingProgress * 100);

  return {
    name: status.suiteName,
    tests: String(status.testCount),
    address: status.address.startsWith("(")
      ? status.address
      : `${status.address.slice(0, 8)}...${status.address.slice(-4)}`,
    balance: `$${status.balanceUsd.toFixed(2)}`,
    goal: `$${status.goalUsd.toFixed(2)}`,
    progress: `${progressPct}%`,
    progressPct,
    funded: status.isFunded ? "✓ Yes" : "✗ No",
  };
}
