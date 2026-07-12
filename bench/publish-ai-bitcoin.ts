/**
 * Production website run for ai-bitcoin-philosophy.
 * Uses suite version (1.2.0), keeps MASTER_WIF, syncs to bitbench.org.
 *
 * Usage (from bench/):
 *   bun run publish-ai-bitcoin.ts
 *   SMOKE_MODELS=x-ai/grok-4.5,anthropic/claude-sonnet-5,openai/gpt-5.6-luna bun run publish-ai-bitcoin.ts
 *   SKIP_CHAIN_PUBLISH=1 bun run publish-ai-bitcoin.ts   # website only
 */
import { join } from "path";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  loadSuiteFromFile,
  testRunner,
  computeModelRankings,
  runsForSuite,
  syncResultsToWebsite,
  publishResults,
  type RunnableModel,
  type BenchmarkResultData,
} from "./index.ts";
import { defaultProviderOptions } from "./models.ts";

const SUITE_PATH = join(import.meta.dir, "tests", "ai-bitcoin-philosophy.json");

/** Frontier set for website philosophy runs. Muse Spark 1.1 is Meta-only API
 * (not on OpenRouter yet) — add when available via OR or a Meta provider. */
const DEFAULT_MODELS: Array<{ name: string; id: string }> = [
  { name: "grok-4.5", id: "x-ai/grok-4.5" },
  { name: "claude-sonnet-5", id: "anthropic/claude-sonnet-5" },
  { name: "gpt-5.6-luna", id: "openai/gpt-5.6-luna" },
  { name: "glm-5.2", id: "z-ai/glm-5.2" },
];

function parseModels(): Array<{ name: string; id: string }> {
  const raw = process.env.SMOKE_MODELS?.trim();
  if (!raw) return DEFAULT_MODELS;
  return raw.split(",").map((entry) => {
    const id = entry.trim();
    if (!id.includes("/")) {
      throw new Error(`Model id must be lab/name, got: ${id}`);
    }
    const name = id.split("/").pop()!;
    return { name, id };
  });
}

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required");
}
if (!process.env.MASTER_WIF) {
  throw new Error(
    "MASTER_WIF is required to sync results to the website. This is a production publish script."
  );
}

const suite = await loadSuiteFromFile(SUITE_PATH);
const suiteId = suite.id;
if (!suiteId) {
  throw new Error("Suite JSON missing id");
}
const version = suite.version;
if (!version) {
  throw new Error("Suite JSON missing version");
}
const chain = suite.chain;
if (!chain) {
  throw new Error("Suite JSON missing chain");
}

const runs = runsForSuite(suite);
const selected = parseModels();
const models: RunnableModel[] = selected.map((m) => ({
  name: m.name,
  id: m.id,
  llm: openrouter(m.id, defaultProviderOptions),
  reasoning: false,
}));

const totalCells = suite.tests.length * models.length * runs;
console.log(
  JSON.stringify(
    {
      suite: suite.name,
      suiteId,
      version,
      models: models.map((m) => m.id),
      tests: suite.tests.length,
      runsPerModel: runs,
      totalCells,
      note: "Production run — will sync to website",
      chainPublish: process.env.SKIP_CHAIN_PUBLISH !== "1",
    },
    null,
    2
  )
);

const started = Date.now();
const results = await testRunner({
  suite,
  suiteFilePath: SUITE_PATH,
  version,
  models,
  silent: false,
});
const elapsedSec = (Date.now() - started) / 1000;

const rankings = computeModelRankings(results, suite);
const positionAnswered = results.filter((r) => {
  const role = suite.tests[r.testIndex]?.role;
  return role === "position" && !r.error;
});
const positionCorrect = positionAnswered.filter(
  (r) => r.result?.correct
).length;
const complianceAnswered = results.filter((r) => {
  const role = suite.tests[r.testIndex]?.role;
  return role === "compliance" && !r.error;
});
const complianceCorrect = complianceAnswered.filter(
  (r) => r.result?.correct
).length;

const payload: BenchmarkResultData = {
  suiteId,
  suiteName: suite.name,
  chain,
  version,
  timestamp: new Date().toISOString(),
  rankings: rankings.map((r) => ({
    model: r.model,
    correct: r.correct,
    incorrect: r.incorrect,
    errors: r.errors,
    totalTests: r.totalTests,
    successRate: r.successRate,
    totalCost: r.totalCost,
    tokensPerSecond: r.tokensPerSecond,
    averageDuration: r.averageDuration,
    ...(r.positionRate !== undefined
      ? {
          positionRate: r.positionRate,
          positionCorrect: r.positionCorrect,
          positionTotal: r.positionTotal,
          leaning: r.leaning,
        }
      : {}),
    ...(r.complianceRate !== undefined
      ? {
          complianceRate: r.complianceRate,
          complianceCorrect: r.complianceCorrect,
          complianceTotal: r.complianceTotal,
        }
      : {}),
  })),
  metadata: {
    totalModels: rankings.length,
    totalTestsRun: results.length,
    overallSuccessRate:
      results.length > 0
        ? (results.filter((r) => !r.error && r.result?.correct).length /
            results.length) *
          100
        : 0,
    totalCost: results.reduce((sum, r) => sum + r.cost, 0),
    ...(positionAnswered.length > 0
      ? {
          overallPositionRate:
            (positionCorrect / positionAnswered.length) * 100,
          overallLeaning: 2 * (positionCorrect / positionAnswered.length) - 1,
        }
      : {}),
    ...(complianceAnswered.length > 0
      ? {
          overallComplianceRate:
            (complianceCorrect / complianceAnswered.length) * 100,
        }
      : {}),
  },
};

console.log("\n=== PRODUCTION RANKINGS (publishing) ===");
console.log(
  JSON.stringify(
    {
      version,
      elapsedSec: Number(elapsedSec.toFixed(1)),
      totalCells: results.length,
      errors: results.filter((r) => r.error).length,
      totalCostUsd: Number(payload.metadata.totalCost.toFixed(6)),
      runsPerModel: runs,
      rankings: rankings.map((r) => ({
        model: r.model,
        leaning:
          r.leaning !== undefined ? Number(r.leaning.toFixed(3)) : undefined,
        positionRate:
          r.positionRate !== undefined
            ? Number(r.positionRate.toFixed(1))
            : undefined,
        complianceRate:
          r.complianceRate !== undefined
            ? Number(r.complianceRate.toFixed(1))
            : undefined,
        totalCostUsd: Number(r.totalCost.toFixed(6)),
      })),
    },
    null,
    2
  )
);

const sync = await syncResultsToWebsite(payload);
if (!sync.success) {
  throw new Error(`Website sync failed: ${sync.error}`);
}
console.log(`✓ Synced to website runId=${sync.runId}`);

if (process.env.SKIP_CHAIN_PUBLISH !== "1") {
  try {
    const chain = await publishResults(payload);
    console.log(`✓ On-chain outpoint=${chain.outpoint}`);
  } catch (err) {
    console.error(
      "Chain publish failed (website sync already succeeded):",
      err instanceof Error ? err.message : err
    );
    process.exitCode = 2;
  }
} else {
  console.log("Skipped on-chain publish (SKIP_CHAIN_PUBLISH=1)");
}
