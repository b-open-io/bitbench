import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type {
  TestSuite,
  TestSuiteFile,
  SuiteWithBalance,
  SuiteRuntimeState,
  Chain,
} from "./types";
import { getDonationAddress, isMasterWifConfigured } from "./addresses";
import { getSuiteState, isRedisConfigured } from "./kv";

// Path to test suite JSON files (source of truth)
const TESTS_DIR = join(process.cwd(), "..", "bench", "tests");

// Number of models we test against
const MODEL_COUNT = 44;

/**
 * Load all test suite files from bench/tests/
 */
async function loadSuiteFiles(): Promise<TestSuiteFile[]> {
  const files = await readdir(TESTS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const suites: TestSuiteFile[] = [];
  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(TESTS_DIR, file), "utf-8");
      const suite = JSON.parse(content) as TestSuiteFile;
      if (suite.id && suite.name && Array.isArray(suite.tests)) {
        suites.push(suite);
      }
    } catch (error) {
      console.error(`Failed to load suite ${file}:`, error);
    }
  }

  // Sort by chain, then by name
  return suites.sort((a, b) => {
    if (a.chain !== b.chain) return a.chain.localeCompare(b.chain);
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get runtime state for a suite from KV, with defaults
 */
async function getRuntimeState(suiteId: string): Promise<SuiteRuntimeState> {
  if (isRedisConfigured()) {
    const state = await getSuiteState(suiteId);
    if (state) return state;
  }

  // Default state for suites without KV data
  return {
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  };
}

/**
 * Convert a suite file to a TestSuite with runtime data
 */
async function suiteFileToTestSuite(file: TestSuiteFile): Promise<TestSuite> {
  const state = await getRuntimeState(file.id);

  return {
    id: file.id,
    name: file.name,
    description: file.description,
    version: file.version,
    testCount: file.tests.length,
    modelCount: MODEL_COUNT,
    estimatedCostUsd: file.estimatedCostUsd,
    donationAddress: isMasterWifConfigured()
      ? getDonationAddress(file.id)
      : `placeholder-address-${file.id}`,
    lastRunAt: state.lastRunAt,
    lastRunVersion: state.lastRunVersion,
    status: state.status,
    chain: file.chain,
  };
}

/**
 * Get all suites with donation addresses and runtime state
 */
export async function getAllSuites(): Promise<TestSuite[]> {
  const files = await loadSuiteFiles();
  return Promise.all(files.map(suiteFileToTestSuite));
}

/**
 * Get a single suite by ID
 */
export async function getSuite(id: string): Promise<TestSuite | null> {
  const files = await loadSuiteFiles();
  const file = files.find((f) => f.id === id);
  if (!file) return null;
  return suiteFileToTestSuite(file);
}

/**
 * Get suites filtered by chain
 */
export async function getSuitesByChain(chain: Chain): Promise<TestSuite[]> {
  const suites = await getAllSuites();
  return suites.filter((s) => s.chain === chain);
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
const BSV_PRICE_USD = 50;

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
