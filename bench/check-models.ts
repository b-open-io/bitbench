#!/usr/bin/env bun
/**
 * Audit the static modelsToRun roster against OpenRouter's live catalog.
 *
 * Reports:
 *  1. Roster models missing from the catalog (run-breaking; exit 1)
 *  2. Catalog pricing for each roster model (spot inflated/changed costs)
 *  3. Recent notable models from tracked labs not yet in the roster
 *
 * Usage: bun run models
 */
import { modelsToRun } from "./constants";

const CATALOG_URL = "https://openrouter.ai/api/v1/models";

// Labs whose new releases are worth surfacing for roster consideration
const TRACKED_LABS = [
  "anthropic",
  "openai",
  "google",
  "x-ai",
  "meta-llama",
  "deepseek",
  "qwen",
  "moonshotai",
  "mistralai",
  "z-ai",
];

const RECENT_DAYS = 90;

interface CatalogModel {
  id: string;
  name: string;
  created: number;
  pricing?: { prompt?: string; completion?: string };
}

function perMillion(price: string | undefined): string {
  if (price === undefined) return "?";
  const n = Number(price) * 1_000_000;
  if (Number.isNaN(n)) return "?";
  return `$${n.toFixed(2)}/M`;
}

const res = await fetch(CATALOG_URL);
if (!res.ok) {
  throw new Error(`OpenRouter catalog fetch failed: ${res.status}`);
}
const catalog = ((await res.json()) as { data: CatalogModel[] }).data;
const catalogById = new Map(catalog.map((m) => [m.id, m]));

console.log(
  `Roster: ${modelsToRun.length} models | Catalog: ${catalog.length} models\n`
);

// 1. Roster vs catalog
let missing = 0;
console.log("── Roster status ──");
for (const model of modelsToRun) {
  const id = model.llm.modelId;
  const entry = catalogById.get(id);
  if (!entry) {
    missing++;
    console.log(`  ✗ MISSING  ${model.name}  (${id}) — not in catalog`);
  } else {
    console.log(
      `  ✓ ${model.name.padEnd(28)} in: ${perMillion(entry.pricing?.prompt).padEnd(10)} out: ${perMillion(entry.pricing?.completion)}`
    );
  }
}

// 2. Recent tracked-lab models not in the roster
const rosterIds = new Set(modelsToRun.map((m) => m.llm.modelId));
const cutoff = Date.now() / 1000 - RECENT_DAYS * 24 * 3600;
const candidates = catalog
  .filter(
    (m) =>
      m.created > cutoff &&
      !rosterIds.has(m.id) &&
      TRACKED_LABS.includes(m.id.split("/")[0]) &&
      !m.id.endsWith(":free")
  )
  .sort((a, b) => b.created - a.created);

console.log(
  `\n── New tracked-lab models (last ${RECENT_DAYS} days, not in roster) ──`
);
if (candidates.length === 0) {
  console.log("  none");
}
for (const m of candidates) {
  const date = new Date(m.created * 1000).toISOString().slice(0, 10);
  console.log(
    `  + ${date}  ${m.id.padEnd(44)} in: ${perMillion(m.pricing?.prompt).padEnd(10)} out: ${perMillion(m.pricing?.completion)}`
  );
}

if (missing > 0) {
  console.error(
    `\n${missing} roster model(s) missing from the OpenRouter catalog — benchmark runs will fail for these. Update bench/constants.ts.`
  );
  process.exit(1);
}
console.log("\nRoster is fully resolvable against the live catalog.");
