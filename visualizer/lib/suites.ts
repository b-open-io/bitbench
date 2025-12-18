import type { TestSuite, SuiteWithBalance, TestSuiteFile } from "./types";
import { getDonationAddress, isMasterWifConfigured } from "./addresses";
import {
  getAllSuites as getAllSuitesFromKV,
  getSuite as getSuiteFromKV,
  setSuite,
  isRedisConfigured,
} from "./kv";

// Hardcoded suite definitions (derived from bench/tests/*.json)
// These are used as defaults when KV is not populated
const SUITE_DEFINITIONS: Omit<TestSuite, "donationAddress">[] = [
  {
    id: "bitcoin-protocols",
    name: "Bitcoin SPV & Data Protocols",
    description:
      "Tests awareness of OP_RETURN, Ordinals, Runes, and BRC-20 protocols.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  },
  {
    id: "bitcoin-script",
    name: "Bitcoin Script & Transactions",
    description:
      "Tests understanding of Bitcoin Script, SegWit, and Taproot.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  },
  {
    id: "bitcoin-libraries",
    name: "Bitcoin Libraries",
    description: "Tests knowledge of popular Bitcoin development libraries.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  },
  {
    id: "bitcoin-parsing",
    name: "Bitcoin Parsing",
    description: "Tests ability to parse Bitcoin transactions and blocks.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  },
  {
    id: "protocol-parsing",
    name: "Protocol Parsing",
    description: "Tests parsing of various Bitcoin data protocols.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  },
  {
    id: "scrypt",
    name: "sCrypt Smart Contracts",
    description: "Tests knowledge of sCrypt Bitcoin smart contract language.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  },
  {
    id: "stratum-puzzle",
    name: "Stratum Mining Protocol",
    description: "Tests understanding of Stratum mining protocol.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  },
  {
    id: "type42",
    name: "Type 42 Key Derivation",
    description: "Tests knowledge of BIP-42 style key derivation.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  },
];

/**
 * Get all suite definitions with donation addresses.
 * Falls back to hardcoded definitions if KV is not available.
 */
export async function getAllSuites(): Promise<TestSuite[]> {
  // Try to get from KV first
  if (isRedisConfigured()) {
    const kvSuites = await getAllSuitesFromKV();
    if (kvSuites.length > 0) {
      return kvSuites;
    }
  }

  // Fall back to hardcoded definitions with generated addresses
  return SUITE_DEFINITIONS.map((suite) => ({
    ...suite,
    donationAddress: isMasterWifConfigured()
      ? getDonationAddress(suite.id)
      : `placeholder-address-${suite.id}`,
  }));
}

/**
 * Get a single suite by ID
 */
export async function getSuite(id: string): Promise<TestSuite | null> {
  // Try KV first
  if (isRedisConfigured()) {
    const kvSuite = await getSuiteFromKV(id);
    if (kvSuite) return kvSuite;
  }

  // Fall back to hardcoded
  const def = SUITE_DEFINITIONS.find((s) => s.id === id);
  if (!def) return null;

  return {
    ...def,
    donationAddress: isMasterWifConfigured()
      ? getDonationAddress(def.id)
      : `placeholder-address-${def.id}`,
  };
}

/**
 * Seed KV with suite definitions (run once during setup)
 */
export async function seedSuites(): Promise<void> {
  if (!isRedisConfigured()) {
    throw new Error("Redis is not configured");
  }

  for (const def of SUITE_DEFINITIONS) {
    const suite: TestSuite = {
      ...def,
      donationAddress: isMasterWifConfigured()
        ? getDonationAddress(def.id)
        : `placeholder-address-${def.id}`,
    };
    await setSuite(suite);
  }
}

// WhatsOnChain API for balance checking
const WOC_API = "https://api.whatsonchain.com/v1/bsv/main";

interface WOCBalance {
  confirmed: number;
  unconfirmed: number;
}

/**
 * Get balance for a BSV address from WhatsOnChain
 */
export async function getAddressBalance(address: string): Promise<number> {
  // Skip for placeholder addresses
  if (address.startsWith("placeholder-")) {
    return 0;
  }

  try {
    const res = await fetch(`${WOC_API}/address/${address}/balance`);
    if (!res.ok) {
      console.error(`WOC balance check failed: ${res.status}`);
      return 0;
    }
    const data: WOCBalance = await res.json();
    return data.confirmed + data.unconfirmed;
  } catch (error) {
    console.error("Failed to fetch balance:", error);
    return 0;
  }
}

// Current BSV price (could be fetched from API, using estimate for now)
const BSV_PRICE_USD = 50; // Update this or fetch from CoinGecko

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
 * Get suite with current balance information
 */
export async function getSuiteWithBalance(
  id: string
): Promise<SuiteWithBalance | null> {
  const suite = await getSuite(id);
  if (!suite) return null;

  const balanceSats = await getAddressBalance(suite.donationAddress);
  const balanceUsd = satsToUsd(balanceSats);
  const goalSats = usdToSats(suite.estimatedCostUsd);

  return {
    ...suite,
    currentBalanceSats: balanceSats,
    currentBalanceUsd: balanceUsd,
    fundingProgress: goalSats > 0 ? Math.min(balanceSats / goalSats, 1) : 0,
  };
}

/**
 * Get all suites with balance information
 */
export async function getAllSuitesWithBalance(): Promise<SuiteWithBalance[]> {
  const suites = await getAllSuites();

  // Fetch balances in parallel
  const suitesWithBalance = await Promise.all(
    suites.map(async (suite) => {
      const balanceSats = await getAddressBalance(suite.donationAddress);
      const balanceUsd = satsToUsd(balanceSats);
      const goalSats = usdToSats(suite.estimatedCostUsd);

      return {
        ...suite,
        currentBalanceSats: balanceSats,
        currentBalanceUsd: balanceUsd,
        fundingProgress: goalSats > 0 ? Math.min(balanceSats / goalSats, 1) : 0,
      };
    })
  );

  return suitesWithBalance;
}
