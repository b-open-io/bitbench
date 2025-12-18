#!/usr/bin/env bun
/**
 * Update model-costs.json from benchmark results
 * Run after a successful benchmark to update cost estimates
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { OUTPUT_DIRECTORY } from "./constants";

interface ResultEntry {
  model: string;
  cost: number;
}

interface ResultFile {
  results: ResultEntry[];
}

async function main() {
  const resultsDir = OUTPUT_DIRECTORY;

  // Collect all costs per model
  const modelCosts: Record<string, number[]> = {};

  // Scan all suite directories
  const suiteDirs = await readdir(resultsDir, { withFileTypes: true });

  for (const suiteDir of suiteDirs) {
    if (!suiteDir.isDirectory()) continue;

    const suitePath = join(resultsDir, suiteDir.name);
    const versionDirs = await readdir(suitePath, { withFileTypes: true });

    for (const versionDir of versionDirs) {
      if (!versionDir.isDirectory()) continue;

      const versionPath = join(suitePath, versionDir.name);
      const files = await readdir(versionPath);

      // Find the latest test-results JSON file
      const resultFiles = files.filter(f => f.startsWith("test-results-") && f.endsWith(".json"));

      for (const resultFile of resultFiles) {
        try {
          const content = await readFile(join(versionPath, resultFile), "utf-8");
          const data = JSON.parse(content) as ResultFile;

          for (const result of data.results) {
            if (result.model && typeof result.cost === "number" && result.cost > 0) {
              if (!modelCosts[result.model]) {
                modelCosts[result.model] = [];
              }
              modelCosts[result.model].push(result.cost);
            }
          }
        } catch (e) {
          // Skip files that can't be parsed
        }
      }
    }
  }

  // Calculate average cost per test for each model
  const avgCosts: Record<string, number> = {};
  for (const [model, costs] of Object.entries(modelCosts)) {
    const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
    avgCosts[model] = Math.round(avg * 10000) / 10000; // Round to 4 decimal places
  }

  // Load existing costs
  const costsPath = join(import.meta.dir, "model-costs.json");
  let existingData: { _meta: any; costs: Record<string, number> };

  try {
    const existing = await readFile(costsPath, "utf-8");
    existingData = JSON.parse(existing);
  } catch {
    existingData = { _meta: {}, costs: {} };
  }

  // Merge with existing (new values overwrite)
  const mergedCosts = { ...existingData.costs, ...avgCosts };

  // Update metadata
  const updatedData = {
    _meta: {
      description: "Average cost per test execution for each model. Updated after benchmark runs.",
      lastUpdated: new Date().toISOString().split("T")[0],
      source: "Aggregated from benchmark results",
      sampleCount: Object.fromEntries(
        Object.entries(modelCosts).map(([model, costs]) => [model, costs.length])
      ),
    },
    costs: mergedCosts,
  };

  await writeFile(costsPath, JSON.stringify(updatedData, null, 2), "utf-8");

  console.log("Updated model costs:");
  console.log(`  Models updated: ${Object.keys(avgCosts).length}`);
  console.log(`  Total models: ${Object.keys(mergedCosts).length}`);
  console.log("");
  console.log("Top 10 most expensive models:");
  Object.entries(mergedCosts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([model, cost]) => {
      console.log(`  ${model}: $${cost.toFixed(4)}/test`);
    });
}

main().catch(console.error);
