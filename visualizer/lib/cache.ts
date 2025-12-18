import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type {
  CachedTestResult,
  QuestionBreakdown,
  QuestionModelResult,
  SuiteQuestionBreakdown,
} from "./types";

// Path to cache directory
const CACHE_DIR = join(process.cwd(), "..", "bench", "results", "cache");

/**
 * Get the latest version directory for a suite
 */
async function getLatestVersion(suiteId: string): Promise<string | null> {
  const suitePath = join(CACHE_DIR, suiteId);
  try {
    const versions = await readdir(suitePath, { withFileTypes: true });
    const versionDirs = versions
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();
    return versionDirs[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Load all cached results for a suite version
 */
async function loadCacheResults(
  suiteId: string,
  version: string
): Promise<CachedTestResult[]> {
  const versionPath = join(CACHE_DIR, suiteId, version);
  const results: CachedTestResult[] = [];

  try {
    const files = await readdir(versionPath);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(versionPath, file), "utf-8");
        const result = JSON.parse(content) as CachedTestResult;
        if (result.testIndex !== undefined && result.result) {
          results.push(result);
        }
      } catch {
        // Skip files that can't be parsed
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return results;
}

/**
 * Aggregate cache results into question-level breakdown
 */
export async function getQuestionBreakdown(
  suiteId: string,
  version?: string
): Promise<SuiteQuestionBreakdown | null> {
  // Get latest version if not specified
  const targetVersion = version ?? (await getLatestVersion(suiteId));
  if (!targetVersion) return null;

  // Load all cache results
  const results = await loadCacheResults(suiteId, targetVersion);
  if (results.length === 0) return null;

  // Group by testIndex
  const questionMap = new Map<number, CachedTestResult[]>();
  for (const result of results) {
    const existing = questionMap.get(result.testIndex) ?? [];
    existing.push(result);
    questionMap.set(result.testIndex, existing);
  }

  // Get unique models
  const allModels = new Set(results.map((r) => r.model));
  const totalModels = allModels.size;

  // Build question breakdowns
  const questions: QuestionBreakdown[] = [];

  for (const [testIndex, testResults] of questionMap) {
    // Use the first result for prompt/answers (should be same across models)
    const first = testResults[0];

    // Dedupe by model (take the first run for each model)
    const modelResultMap = new Map<string, CachedTestResult>();
    for (const result of testResults) {
      if (!modelResultMap.has(result.model)) {
        modelResultMap.set(result.model, result);
      }
    }

    const modelResults: QuestionModelResult[] = [];
    let correctCount = 0;

    for (const [model, result] of modelResultMap) {
      if (result.result.correct) {
        correctCount++;
      }
      modelResults.push({
        model,
        correct: result.result.correct,
        response: result.result.text,
        duration: result.duration,
        cost: result.cost,
      });
    }

    // Sort model results by correct (incorrect first), then by model name
    modelResults.sort((a, b) => {
      if (a.correct !== b.correct) return a.correct ? 1 : -1;
      return a.model.localeCompare(b.model);
    });

    const modelsWithResults = modelResultMap.size;
    questions.push({
      testIndex,
      prompt: first.prompt,
      answers: first.answers,
      totalModels: modelsWithResults,
      correctCount,
      successRate: modelsWithResults > 0 ? (correctCount / modelsWithResults) * 100 : 0,
      modelResults,
    });
  }

  // Sort questions by success rate (lowest first - most problematic)
  questions.sort((a, b) => a.successRate - b.successRate);

  return {
    suiteId,
    version: targetVersion,
    totalQuestions: questions.length,
    totalModels,
    questions,
  };
}

/**
 * Check if cache exists for a suite
 */
export async function hasCacheResults(suiteId: string): Promise<boolean> {
  const version = await getLatestVersion(suiteId);
  if (!version) return false;

  const results = await loadCacheResults(suiteId, version);
  return results.length > 0;
}
