import { Redis } from "@upstash/redis";
import type {
  BenchmarkRun,
  Donation,
  SuiteRuntimeState,
} from "./types";

// Initialize Redis client (Vercel KV uses these env var names)
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Key patterns
const KEYS = {
  suiteState: (id: string) => `suite:${id}:state`,
  suiteDonations: (id: string) => `suite:${id}:donations`,
  suiteRuns: (id: string) => `suite:${id}:runs`,
  suiteLatest: (id: string) => `suite:${id}:latest`,
  suiteNotified: (id: string) => `suite:${id}:notified`,
  addressToSuite: (address: string) => `address:${address}`,
};

// Suite runtime state operations (JSON files are source of truth for static data)
export async function getSuiteState(
  id: string
): Promise<SuiteRuntimeState | null> {
  return redis.get<SuiteRuntimeState>(KEYS.suiteState(id));
}

export async function setSuiteState(
  id: string,
  state: SuiteRuntimeState
): Promise<void> {
  await redis.set(KEYS.suiteState(id), state);
}

export async function getSuiteIdByAddress(
  address: string
): Promise<string | null> {
  return redis.get<string>(KEYS.addressToSuite(address));
}

export async function setAddressToSuite(
  address: string,
  suiteId: string
): Promise<void> {
  await redis.set(KEYS.addressToSuite(address), suiteId);
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

// Notification tracking - prevent duplicate funding notifications
export async function wasFundingNotificationSent(
  suiteId: string
): Promise<boolean> {
  const notified = await redis.get<string>(KEYS.suiteNotified(suiteId));
  return notified === "true";
}

export async function markFundingNotificationSent(
  suiteId: string
): Promise<void> {
  await redis.set(KEYS.suiteNotified(suiteId), "true");
}

export async function clearFundingNotification(suiteId: string): Promise<void> {
  await redis.del(KEYS.suiteNotified(suiteId));
}

// Utility to check if Redis is configured
export function isRedisConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// Get latest run for a specific suite
export async function getLatestRunForSuite(
  suiteId: string
): Promise<BenchmarkRun | null> {
  return getLatestRun(suiteId);
}
