#!/usr/bin/env bun
/**
 * Audit the dynamic OpenRouter model registry.
 *
 * Usage:
 *   bun run models
 *   bun run models --write
 */
import { readdir, readFile, writeFile } from "fs/promises";
import { basename, join } from "path";
import {
  DEFAULT_FILTER,
  estimateBenchmarkCost,
  fetchCatalog,
  resolveModels,
  type ModelFilter,
} from "./models";

type TestSuiteFile = {
  id?: string;
  name: string;
  estimatedCostUsd?: number;
  /** Per-model run count; defaults to TEST_RUNS_PER_MODEL when omitted. */
  runs?: number;
  model_filter?: ModelFilter;
  tests: Array<unknown>;
};

type SnapshotModel = { name: string; id: string; estCostPerTest: number };

type ResolvedSnapshot = {
  generatedAt: string;
  defaultModelCount: number;
  defaultModels: SnapshotModel[];
  suites: Record<
    string,
    {
      modelCount: number;
      estimatedCostUsd: number;
      // Present only when the suite declares a model_filter narrowing the
      // default registry; absent means "runs on the default model set".
      models?: SnapshotModel[];
    }
  >;
};

const WRITE = process.argv.includes("--write");
const testsDir = join(import.meta.dir, "tests");
const snapshotPath = join(import.meta.dir, "models-resolved.json");

function perMillion(price: number | undefined): string {
  if (price === undefined) return "?";
  return `$${(price * 1_000_000).toFixed(2)}/M`;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundCents6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

async function loadSuites(): Promise<
  Array<{ id: string; file: string; suite: TestSuiteFile }>
> {
  const entries = await readdir(testsDir, { withFileTypes: true });
  const suites: Array<{ id: string; file: string; suite: TestSuiteFile }> = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

    const file = join(testsDir, entry.name);
    const parsed = JSON.parse(await readFile(file, "utf-8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      "tests" in parsed &&
      Array.isArray((parsed as { tests?: unknown }).tests)
    ) {
      const suite = parsed as TestSuiteFile;
      suites.push({
        id: suite.id ?? basename(entry.name, ".json"),
        file,
        suite,
      });
    }
  }

  return suites.sort((a, b) => a.id.localeCompare(b.id));
}

const catalog = await fetchCatalog();
const defaultModels = await resolveModels();

console.log(
  `Dynamic registry: ${defaultModels.length} default models | Catalog: ${catalog.length} models`
);
console.log(`Default filter: ${JSON.stringify(DEFAULT_FILTER)}\n`);

if (defaultModels.length <= 10) {
  throw new Error(
    `Default model resolver returned only ${defaultModels.length} models; expected > 10`
  );
}

console.log("── Resolved default models ──");
for (const model of defaultModels) {
  console.log(
    `  ✓ ${model.name.padEnd(38)} ${model.id.padEnd(44)} in: ${perMillion(
      model.promptPriceUsd
    ).padEnd(10)} out: ${perMillion(model.completionPriceUsd)}${
      model.reasoning ? " reasoning" : ""
    }`
  );
}

const suites = await loadSuites();
const snapshot: ResolvedSnapshot = {
  generatedAt: new Date().toISOString(),
  defaultModelCount: defaultModels.length,
  defaultModels: defaultModels.map((m) => ({
    name: m.name,
    id: m.id,
    estCostPerTest: roundCents6(m.avgCostPerTest ?? 0),
  })),
  suites: {},
};

console.log("\n── Suite cost drift ──");
for (const { id, suite } of suites) {
  const models = await resolveModels(suite.model_filter);
  const runsPerModel =
    suite.runs !== undefined
      ? suite.runs
      : 1; /* match constants.TEST_RUNS_PER_MODEL default */
  if (suite.runs !== undefined && (!Number.isInteger(suite.runs) || suite.runs < 1)) {
    throw new Error(`Suite ${id}: runs must be a positive integer, got ${suite.runs}`);
  }
  const estimatedCostUsd = roundCents(
    estimateBenchmarkCost(models, suite.tests.length, runsPerModel)
  );
  snapshot.suites[id] = {
    modelCount: models.length,
    estimatedCostUsd,
    ...(suite.model_filter
      ? {
          models: models.map((m) => ({
            name: m.name,
            id: m.id,
            estCostPerTest: roundCents6(m.avgCostPerTest ?? 0),
          })),
        }
      : {}),
  };

  const current = suite.estimatedCostUsd;
  const delta = current === undefined ? undefined : estimatedCostUsd - current;
  const marker =
    delta === undefined ? "?" : Math.abs(delta) < 0.005 ? " " : delta > 0 ? "+" : "-";
  const currentLabel =
    current === undefined ? "missing" : `$${current.toFixed(2)}`;
  const deltaLabel = delta === undefined ? "" : ` (${delta >= 0 ? "+" : ""}${delta.toFixed(2)})`;

  console.log(
    `${marker} ${id.padEnd(24)} models=${String(models.length).padStart(
      3
    )} suite=${currentLabel.padStart(8)} computed=$${estimatedCostUsd
      .toFixed(2)
      .padStart(7)}${deltaLabel}`
  );
}

if (WRITE) {
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
  console.log(`\nWrote ${snapshotPath}`);
}

console.log("\nDynamic model registry audit completed.");
