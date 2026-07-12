/**
 * Cheap multi-model pilot for ai-bitcoin-philosophy.
 * Unpublished (MASTER_WIF stripped). Version is pilot-* so it never collides with production.
 *
 * Usage (from bench/):
 *   bun run pilot-ai-bitcoin.ts
 *   PILOT_VERSION=pilot-1.8.1-2026-07-12 bun run pilot-ai-bitcoin.ts
 *   SMOKE_MODELS=google/gemini-2.5-flash-lite bun run pilot-ai-bitcoin.ts
 */
import { join } from "path";
import {
  loadSuiteFromFile,
  testRunner,
  computeModelRankings,
  runsForSuite,
} from "./index.ts";
import { resolvePhilosophyModels } from "./ai-bitcoin-models.ts";

const VERSION =
  process.env.PILOT_VERSION ?? "pilot-1.8.1-2026-07-12";
const SUITE_PATH = join(import.meta.dir, "tests", "ai-bitcoin-philosophy.json");

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required for pilot");
}
if (process.env.MASTER_WIF) {
  console.warn("Stripping MASTER_WIF for pilot (not publishing).");
  delete process.env.MASTER_WIF;
}

const suite = await loadSuiteFromFile(SUITE_PATH);
const runs = runsForSuite(suite);
const { specs, models } = resolvePhilosophyModels();

const totalCells = suite.tests.length * models.length * runs;
console.log(
  JSON.stringify(
    {
      suite: suite.name,
      suiteId: suite.id,
      suiteVersionField: suite.version,
      pilotVersion: VERSION,
      models: specs.map((m) => ({
        name: m.name,
        id: m.id,
        effort: m.effortLabel,
      })),
      tests: suite.tests.length,
      runsPerModel: runs,
      totalCells,
      note: "Unpublished pilot — not production data",
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
        totalCompletionTokens: r.totalCompletionTokens,
      })),
    },
    null,
    2
  )
);
