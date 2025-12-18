import { readdir, readFile } from "fs/promises";
import { join } from "path";

const CACHE_DIR = "bench/results/cache";

async function analyzeCosts() {
  const modelStats = {};
  
  async function walk(dir) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.name.endsWith(".json")) {
          try {
            const content = await readFile(fullPath, "utf-8");
            const data = JSON.parse(content);
            
            // Validate data
            if (!data.model || typeof data.cost !== 'number') continue;
            
            const model = data.model;
            if (!modelStats[model]) {
              modelStats[model] = { totalCost: 0, count: 0 };
            }
            
            modelStats[model].totalCost += data.cost;
            modelStats[model].count += 1;
            
          } catch (e) {
            // Ignore bad files
          }
        }
      }
    } catch (e) {
      console.error("Error reading directory:", e);
    }
  }

  await walk(CACHE_DIR);
  
  console.log("Model Cost Analysis (Average Cost per Test):");
  const table = [];
  for (const [model, stats] of Object.entries(modelStats)) {
    const avgCost = stats.count > 0 ? stats.totalCost / stats.count : 0;
    table.push({
      model,
      avgCost: avgCost.toFixed(6),
      testsRun: stats.count
    });
  }
  
  // Sort by cost descending
  table.sort((a, b) => parseFloat(b.avgCost) - parseFloat(a.avgCost));
  console.table(table);
}

analyzeCosts();
