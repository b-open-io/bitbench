/**
 * Disposable smoke: prove OpenRouter + suite load + scoring path.
 * Version is smoke-pipe-* so it never collides with 1.2.0 cache/publish.
 * Does NOT publish. Refuse to run if MASTER_WIF is set.
 *
 * Usage (from bench/):
 *   env -u MASTER_WIF bun run smoke-pipe.ts
 */
import { join } from "path";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  loadSuiteFromFile,
  testRunner,
  type RunnableModel,
} from "./index.ts";
import { defaultProviderOptions } from "./models.ts";

const MODEL_ID = process.env.SMOKE_MODEL_ID ?? "google/gemini-2.5-flash-lite";
const MODEL_NAME = process.env.SMOKE_MODEL_NAME ?? "gemini-2.5-flash-lite";
const VERSION = process.env.SMOKE_VERSION ?? "smoke-pipe-2026-07-12";
const SUITE_PATH = join(import.meta.dir, "tests", "ai-bitcoin-philosophy.json");

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required for smoke");
}
// Bun auto-loads bench/.env after shell env -u; strip publish key so smoke cannot chain-publish.
if (process.env.MASTER_WIF) {
  console.warn("Stripping MASTER_WIF for smoke (loaded from .env; not publishing).");
  delete process.env.MASTER_WIF;
}

const suite = await loadSuiteFromFile(SUITE_PATH);
const models: RunnableModel[] = [
  {
    name: MODEL_NAME,
    id: MODEL_ID,
    llm: openrouter(MODEL_ID, defaultProviderOptions),
    reasoning: false,
  },
];

console.log(
  JSON.stringify(
    {
      suite: suite.name,
      suiteId: suite.id,
      suiteVersionField: suite.version,
      smokeVersion: VERSION,
      model: MODEL_ID,
      tests: suite.tests.length,
    },
    null,
    2
  )
);

const results = await testRunner({
  suite,
  suiteFilePath: SUITE_PATH,
  version: VERSION,
  models,
  silent: false,
});

const correct = results.filter((r) => !r.error && r.result?.correct).length;
const incorrect = results.filter((r) => !r.error && !r.result?.correct).length;
const errors = results.filter((r) => r.error).length;
const totalCost = results.reduce((sum, r) => sum + (r.cost ?? 0), 0);

console.log("\n=== SMOKE SUMMARY (not benchmark data; do not publish) ===");
console.log(
  JSON.stringify(
    {
      smokeVersion: VERSION,
      model: MODEL_ID,
      total: results.length,
      correct,
      incorrect,
      errors,
      foldedPassRatePct:
        results.length > 0
          ? Number(((correct / results.length) * 100).toFixed(1))
          : null,
      totalCostUsd: Number(totalCost.toFixed(6)),
      note: "Folded pass rate mixes position + compliance; honest metrics land after role split.",
    },
    null,
    2
  )
);
