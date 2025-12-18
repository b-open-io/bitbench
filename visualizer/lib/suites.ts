import type { TestSuite, SuiteWithBalance, Chain } from "./types";
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
  // ═══════════════════════════════════════════════════════════════════════════
  // BSV (Bitcoin SV) - Unbounded scaling, data protocols, sCrypt
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bitcoin-protocols",
    name: "BSV Data Protocols",
    description:
      "1Sat Ordinals, MAP, AIP, B protocol, and OP_RETURN data embedding.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "bsv",
  },
  {
    id: "bitcoin-libraries",
    name: "BSV SDK & Libraries",
    description: "Tests knowledge of @bsv/sdk, transaction building, and SPV.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "bsv",
  },
  {
    id: "bitcoin-parsing",
    name: "BSV Transaction Parsing",
    description: "Parsing BSV transactions, scripts, and block structures.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "bsv",
  },
  {
    id: "protocol-parsing",
    name: "BSV Protocol Parsing",
    description: "Parsing MAP, AIP, BAP, and Sigma protocol data.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "bsv",
  },
  {
    id: "scrypt",
    name: "sCrypt Smart Contracts",
    description: "sCrypt language, Bitcoin smart contracts, and tooling.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "bsv",
  },
  {
    id: "type42",
    name: "Type 42 Key Derivation",
    description: "BSV-specific Type 42 key derivation and Paymail.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "bsv",
  },
  {
    id: "stratum-puzzle",
    name: "Stratum Mining Protocol",
    description: "Mining pool protocol, puzzle construction, and hashrate.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "bsv",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BTC (Bitcoin Core) - Lightning, Taproot, PSBT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "btc-lightning",
    name: "Lightning Network",
    description: "BOLT specs, channel management, routing, and LND/CLN APIs.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "btc",
  },
  {
    id: "btc-taproot",
    name: "Taproot & Schnorr",
    description: "BIP-340 Schnorr signatures, Tapscript, and MAST.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "btc",
  },
  {
    id: "btc-psbt",
    name: "PSBT & Miniscript",
    description: "Partially Signed Bitcoin Transactions and Miniscript policy.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "btc",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETH (Ethereum) - Solidity, EVM, Layer 2
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "eth-solidity",
    name: "Solidity & EVM",
    description: "Solidity patterns, EVM opcodes, gas optimization.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "eth",
  },
  {
    id: "eth-tokens",
    name: "Token Standards",
    description: "ERC-20, ERC-721, ERC-1155, and ERC-4337 account abstraction.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "eth",
  },
  {
    id: "eth-layer2",
    name: "Layer 2 Scaling",
    description: "Optimism, Arbitrum, Base, and rollup architecture.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "eth",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOL (Solana) - Anchor, SPL, Metaplex
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "sol-anchor",
    name: "Anchor & Programs",
    description: "Anchor framework, Rust programs, PDAs, and CPIs.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "sol",
  },
  {
    id: "sol-tokens",
    name: "SPL & Metaplex",
    description: "SPL tokens, Metaplex NFTs, and compressed NFTs.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "sol",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BCH (Bitcoin Cash) - CashScript, CashTokens
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bch-cashscript",
    name: "CashScript",
    description: "CashScript smart contracts and libauth library.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "bch",
  },
  {
    id: "bch-cashtokens",
    name: "CashTokens",
    description: "Fungible tokens, NFTs, and BCMR metadata.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "bch",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LTC (Litecoin) - MWEB, OmniLite
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "ltc-mweb",
    name: "MWEB Privacy",
    description: "MimbleWimble Extension Blocks and confidential transactions.",
    testCount: 5,
    modelCount: 44,
    estimatedCostUsd: 2.5,
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
    chain: "ltc",
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

/**
 * Get suites filtered by chain
 */
export async function getSuitesByChain(chain: Chain): Promise<TestSuite[]> {
  const suites = await getAllSuites();
  return suites.filter((s) => s.chain === chain);
}
