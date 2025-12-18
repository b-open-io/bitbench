// Test suite types matching bench/tests/*.json structure
export interface TestQuestion {
  prompt: string;
  answers: string[];
  negative_answers?: string[];
}

// JSON file schema - this is the source of truth
export interface TestSuiteFile {
  id: string;
  chain: Chain;
  name: string;
  description: string;
  version: string;
  estimatedCostUsd: number;
  system_prompt: string;
  tests: TestQuestion[];
}

// Suite status for tracking benchmark state
export type SuiteStatus = "funding" | "pending" | "completed";

// Supported blockchain chains
export type Chain = "bsv" | "btc" | "eth" | "sol" | "bch" | "ltc";

// Chain metadata for display - using theme colors
export const CHAIN_INFO: Record<
  Chain,
  { name: string; color: string; bgColor: string }
> = {
  bsv: { name: "BSV", color: "text-chart-1", bgColor: "bg-chart-1/10" },
  btc: { name: "BTC", color: "text-chart-4", bgColor: "bg-chart-4/10" },
  eth: { name: "ETH", color: "text-chart-3", bgColor: "bg-chart-3/10" },
  sol: { name: "SOL", color: "text-chart-5", bgColor: "bg-chart-5/10" },
  bch: { name: "BCH", color: "text-chart-2", bgColor: "bg-chart-2/10" },
  ltc: { name: "LTC", color: "text-muted-foreground", bgColor: "bg-muted/50" },
};

// Runtime state stored in KV (not in JSON files)
export interface SuiteRuntimeState {
  lastRunAt: string | null;
  lastRunVersion: string | null;
  status: SuiteStatus;
}

// Combined suite with all data for API responses
export interface TestSuite {
  id: string;
  name: string;
  description: string;
  version: string;
  testCount: number;
  modelCount: number;
  estimatedCostUsd: number;
  donationAddress: string;
  lastRunAt: string | null;
  lastRunVersion: string | null;
  status: SuiteStatus;
  chain: Chain;
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

// Detailed question-level results from cache files
export interface CachedTestResult {
  cacheVersion: number;
  timestamp: string;
  suiteId: string;
  suiteName: string;
  version: string;
  model: string;
  runNumber: number;
  testIndex: number;
  system_prompt: string;
  prompt: string;
  answers: string[];
  negative_answers?: string[];
  duration: number;
  cost: number;
  completionTokens: number;
  signature: string;
  result: {
    text: string;
    correct: boolean;
  };
}

// Aggregated question performance across models
export interface QuestionBreakdown {
  testIndex: number;
  prompt: string;
  answers: string[];
  totalModels: number;
  correctCount: number;
  successRate: number;
  modelResults: QuestionModelResult[];
}

export interface QuestionModelResult {
  model: string;
  correct: boolean;
  response: string;
  duration: number;
  cost: number;
}

// Suite question breakdown response
export interface SuiteQuestionBreakdown {
  suiteId: string;
  version: string;
  totalQuestions: number;
  totalModels: number;
  questions: QuestionBreakdown[];
}
