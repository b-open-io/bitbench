// Test suite types matching bench/tests/*.json structure
export interface TestQuestion {
  prompt: string;
  answers: string[];
  negative_answers?: string[];
}

export interface TestSuiteFile {
  name: string;
  description: string;
  system_prompt: string;
  tests: TestQuestion[];
}

// Suite status for tracking benchmark state
export type SuiteStatus = "funding" | "pending" | "completed";

// Supported blockchain chains
export type Chain = "bsv" | "btc" | "eth" | "sol" | "bch" | "ltc";

// Chain metadata for display
export const CHAIN_INFO: Record<
  Chain,
  { name: string; color: string; bgColor: string }
> = {
  bsv: { name: "BSV", color: "text-orange-500", bgColor: "bg-orange-500/10" },
  btc: { name: "BTC", color: "text-amber-500", bgColor: "bg-amber-500/10" },
  eth: { name: "ETH", color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
  sol: { name: "SOL", color: "text-purple-500", bgColor: "bg-purple-500/10" },
  bch: { name: "BCH", color: "text-green-500", bgColor: "bg-green-500/10" },
  ltc: { name: "LTC", color: "text-slate-400", bgColor: "bg-slate-400/10" },
};

// Database types for donation tracking
export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCount: number;
  modelCount: number;
  estimatedCostUsd: number;
  donationAddress: string;
  lastRunAt: string | null;
  lastRunVersion: string | null;
  status: SuiteStatus;
  chain: Chain; // Primary chain this suite tests
}

export interface Donation {
  txid: string;
  suiteId: string;
  amountSats: number;
  amountUsd: number;
  timestamp: string;
  fromAddress?: string;
}

export interface ModelResult {
  model: string;
  provider: string;
  score: number;
  correct: number;
  total: number;
  avgResponseTime: number;
  cost: number;
  tokensPerSecond: number;
}

export interface BenchmarkRun {
  id: string;
  suiteId: string;
  version: string;
  timestamp: string;
  rankings: ModelResult[];
  totalCost: number;
  duration: number;
}

// API response types
export interface SuiteWithBalance extends TestSuite {
  currentBalanceSats: number;
  currentBalanceUsd: number;
  fundingProgress: number;
}
