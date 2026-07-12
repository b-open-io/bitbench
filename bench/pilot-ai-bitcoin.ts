/**
 * Cheap multi-model pilot for ai-bitcoin-philosophy.
 * Unpublished (MASTER_WIF stripped). Version is pilot-* so it never collides with 1.2.0.
 *
 * Usage (from bench/):
 *   bun run pilot-ai-bitcoin.ts
 *   SMOKE_MODELS=google/gemini-2.5-flash-lite,deepseek/deepseek-v4-flash bun run pilot-ai-bitcoin.ts
 */
import { join } from "path";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  loadSuiteFromFile,
  testRunner,
  computeModelRankings,
  runsForSuite,
  type RunnableModel,
} from "./index.ts";
import { defaultProviderOptions } from "./models.ts";

const VERSION =
  process.env.PILOT_VERSION ?? "pilot-1.2.0-2026-07-12";
const SUITE_PATH = join(import.meta.dir, "tests", "ai-bitcoin-philosophy.json");

/** name|id pairs — keep cheap and diverse labs */
const DEFAULT_MODELS: Array<{ name: string; id: string }> = [
  { name: "gemini-2.5-flash-lite", id: "google/gemini-2.5-flash-lite" },
  { name: "deepseek-v4-flash", id: "deepseek/deepseek-v4-flash" },
  { name: "qwen3.5-flash-02-23", id: "qwen/qwen3.5-flash-02-23" },
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
  throw new Error("OPENROUTER_API_KEY is required for pilot");
}
if (process.env.MASTER_WIF) {
  console.warn("Stripping MASTER_WIF for pilot (not publishing).");
  delete process.env.MASTER_WIF;
}

const suite = await loadSuiteFromFile(SUITE_PATH);
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
      suiteId: suite.id,
      suiteVersionField: suite.version,
      pilotVersion: VERSION,
      models: models.map((m) => m.id),
      tests: suite.tests.length,
      runsPerModel: runs,
      totalCells,
      note: "Unpublished pilot — not 1.2.0 production data",
    },
    null,
    2
  )
);

const started = Date.now();
const results = await testRunner({
  suite,
  suiteFilePath: SUITE_PATH,
  version: VERSION,
  models,
  silent: false,
});
const elapsedSec = (Date.now() - started) / 1000;

const rankings = computeModelRankings(results, suite);
const totalCost = results.reduce((sum, r) => sum + (r.cost ?? 0), 0);
const errors = results.filter((r) => r.error).length;

console.log("\n=== PILOT RANKINGS (unpublished) ===");
console.log(
  JSON.stringify(
    {
      pilotVersion: VERSION,
      elapsedSec: Number(elapsedSec.toFixed(1)),
      totalCells: results.length,
      errors,
      totalCostUsd: Number(totalCost.toFixed(6)),
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
        foldedSuccessRate: Number(r.successRate.toFixed(1)),
        correct: r.correct,
        incorrect: r.incorrect,
        errors: r.errors,
        totalCostUsd: Number(r.totalCost.toFixed(6)),
      })),
    },
    null,
    2
  )
);
