import { Redis } from "@upstash/redis";
import type {
  BenchmarkRun,
  Donation,
  TestSuite,
  SuiteWithBalance,
} from "./types";

// Initialize Redis client (Vercel KV uses these env var names)
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Key patterns
const KEYS = {
  suites: "suites",
  suite: (id: string) => `suite:${id}`,
  suiteDonations: (id: string) => `suite:${id}:donations`,
  suiteRuns: (id: string) => `suite:${id}:runs`,
  suiteLatest: (id: string) => `suite:${id}:latest`,
  addressToSuite: (address: string) => `address:${address}`,
};

// Suite operations
export async function getAllSuiteIds(): Promise<string[]> {
  const ids = await redis.smembers(KEYS.suites);
  return ids;
}

export async function getSuite(id: string): Promise<TestSuite | null> {
  return redis.get<TestSuite>(KEYS.suite(id));
}

export async function getAllSuites(): Promise<TestSuite[]> {
  const ids = await getAllSuiteIds();
  if (ids.length === 0) return [];

  const suites = await Promise.all(ids.map((id) => getSuite(id)));
  return suites.filter((s): s is TestSuite => s !== null);
}

export async function setSuite(suite: TestSuite): Promise<void> {
  await redis.set(KEYS.suite(suite.id), suite);
  await redis.sadd(KEYS.suites, suite.id);
  // Also create reverse lookup from address to suite
  await redis.set(KEYS.addressToSuite(suite.donationAddress), suite.id);
}

export async function getSuiteByAddress(
  address: string
): Promise<TestSuite | null> {
  const suiteId = await redis.get<string>(KEYS.addressToSuite(address));
  if (!suiteId) return null;
  return getSuite(suiteId);
}

// Donation operations
export async function addDonation(donation: Donation): Promise<void> {
  const timestamp = new Date(donation.timestamp).getTime();
  await redis.zadd(KEYS.suiteDonations(donation.suiteId), {
    score: timestamp,
    member: JSON.stringify(donation),
  });
}

export async function getDonations(
  suiteId: string,
  limit = 50
): Promise<Donation[]> {
  const results = await redis.zrange<string[]>(
    KEYS.suiteDonations(suiteId),
    0,
    limit - 1,
    { rev: true }
  );
  return results.map((r) => JSON.parse(r) as Donation);
}

export async function getTotalDonationsSats(suiteId: string): Promise<number> {
  const donations = await getDonations(suiteId, 1000);
  return donations.reduce((sum, d) => sum + d.amountSats, 0);
}

// Benchmark run operations
export async function addBenchmarkRun(run: BenchmarkRun): Promise<void> {
  const timestamp = new Date(run.timestamp).getTime();
  await redis.zadd(KEYS.suiteRuns(run.suiteId), {
    score: timestamp,
    member: JSON.stringify(run),
  });
  // Also store as latest
  await redis.set(KEYS.suiteLatest(run.suiteId), run);
}

export async function getLatestRun(
  suiteId: string
): Promise<BenchmarkRun | null> {
  return redis.get<BenchmarkRun>(KEYS.suiteLatest(suiteId));
}

export async function getBenchmarkRuns(
  suiteId: string,
  limit = 20
): Promise<BenchmarkRun[]> {
  const results = await redis.zrange<string[]>(
    KEYS.suiteRuns(suiteId),
    0,
    limit - 1,
    { rev: true }
  );
  return results.map((r) => JSON.parse(r) as BenchmarkRun);
}

// Clear donations for a suite (after benchmark run)
export async function clearDonations(suiteId: string): Promise<void> {
  await redis.del(KEYS.suiteDonations(suiteId));
}

// Utility to check if Redis is configured
export function isRedisConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}
