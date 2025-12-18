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
  status: SuiteStatus; // funding = accepting donations, pending = waiting for admin to run, completed = results uploaded
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
