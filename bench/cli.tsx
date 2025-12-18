#!/usr/bin/env node
import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readdir, readFile } from "fs/promises";
import {
  loadSuiteFromFile,
  testRunner,
  publishResults,
  isPublishingConfigured,
  modelsToRun,
  estimateBenchmarkCost,
  TEST_RUNS_PER_MODEL,
  getCacheStatus,
  type TestSuite,
  type RunnerEvent,
  type BenchmarkResultData,
  type RunnableModel,
  type CacheStatus,
} from "./index";
import {
  getAllFundingStatus,
  formatFundingRow,
  isMasterWifConfigured,
  type FundingStatus,
} from "./funding";
import { writeFile as fsWriteFile, mkdir } from "fs/promises";

function ensureRefUnref(stream: any) {
  if (!stream) return stream;
  if (typeof stream.ref !== "function") stream.ref = () => {};
  if (typeof stream.unref !== "function") stream.unref = () => {};
  return stream;
}

const stdin = ensureRefUnref(process.stdin as any);
const stdout = ensureRefUnref(process.stdout as any);
const stderr = ensureRefUnref(process.stderr as any);

// Check for --force flag to bypass funding check
const FORCE_RUN = process.argv.includes("--force");

function useBenchRoot() {
  const here = fileURLToPath(import.meta.url);
  return dirname(here);
}

async function findTestSuites(testsDir: string) {
  const entries = await readdir(testsDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));
  const suites: Array<{ filePath: string; suite: TestSuite; id: string }> = [];
  for (const f of files) {
    try {
      const filePath = join(testsDir, f.name);
      const raw = await readFile(filePath, "utf-8");
      const json = JSON.parse(raw) as TestSuite;
      if (json && json.name && Array.isArray(json.tests)) {
        suites.push({
          filePath,
          suite: json,
          id: f.name.replace(".json", ""),
        });
      }
    } catch {}
  }
  return suites;
}

function formatDefaultVersion() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type ModelStats = {
  total: number;
  executeTotal: number;
  reuseTotal: number;
  reuseCompleted: number;
  executedStarted: number;
  executedDone: number;
  executedErrors: number;
  executedDurationSumMs: number;
  executedMaxDurationMs: number;
  correctCount: number;
  incorrectCount: number;
  costSum: number;
  completionTokensSum: number;
};

function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const width =
    typeof (stdout as any).columns === "number"
      ? Math.max(20, Math.min(60, (stdout as any).columns - 30))
      : 40;
  const ratio = total > 0 ? completed / total : 0;
  const filled = Math.round(width * ratio);
  const empty = width - filled;
  const percent = total > 0 ? Math.floor(ratio * 100) : 0;
  const filledStr = "█".repeat(filled);
  const emptyStr = "░".repeat(empty);
  return (
    <Text>
      [<Text color="green">{filledStr}</Text>
      <Text color="gray">{emptyStr}</Text>] <Text color="cyan">{percent}%</Text>{" "}
      (<Text color="green">{completed}</Text>/<Text color="white">{total}</Text>{" "}
      completed)
    </Text>
  );
}

function FundingProgressBar({ progress }: { progress: number }) {
  const width = 10;
  const filled = Math.round(width * progress);
  const empty = width - filled;
  const filledStr = "█".repeat(filled);
  const emptyStr = "░".repeat(empty);
  const color = progress >= 1 ? "green" : progress >= 0.5 ? "yellow" : "red";
  return (
    <Text>
      <Text color={color}>{filledStr}</Text>
      <Text color="gray">{emptyStr}</Text>
    </Text>
  );
}

function pad(str: string, width: number) {
  if (str.length === width) return str;
  if (str.length < width) return str.padEnd(width, " ");
  if (width <= 1) return str.slice(0, width);
  return str.slice(0, Math.max(0, width - 1)) + "…";
}

function padLeft(str: string, width: number) {
  if (str.length === width) return str;
  if (str.length < width) return str.padStart(width, " ");
  return str.slice(-width);
}

function pctColor(p: number) {
  if (p >= 80) return "green" as const;
  if (p >= 50) return "yellow" as const;
  return "red" as const;
}

// Funding Status Table Component
function FundingTable({ statuses }: { statuses: FundingStatus[] }) {
  const rows = statuses.map(formatFundingRow);

  const widths = {
    name: Math.max(10, ...rows.map((r) => r.name.length)),
    tests: Math.max(5, ...rows.map((r) => r.tests.length)),
    address: Math.max(16, ...rows.map((r) => r.address.length)),
    balance: Math.max(8, ...rows.map((r) => r.balance.length)),
    goal: Math.max(6, ...rows.map((r) => r.goal.length)),
    progress: 10, // Fixed for progress bar
    funded: Math.max(8, ...rows.map((r) => r.funded.length)),
  };

  const totalRaised = statuses.reduce((sum, s) => sum + s.balanceUsd, 0);
  const totalGoal = statuses.reduce((sum, s) => sum + s.goalUsd, 0);
  const fundedCount = statuses.filter((s) => s.isFunded).length;

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        ╔═══════════════════════════════════════════════════════════════════════╗
      </Text>
      <Text bold color="cyan">
        ║                        BITBENCH FUNDING STATUS                        ║
      </Text>
      <Text bold color="cyan">
        ╚═══════════════════════════════════════════════════════════════════════╝
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text underline color="whiteBright">
            {pad("Suite", widths.name)}
          </Text>
          {"  "}
          <Text underline color="whiteBright">
            {padLeft("Tests", widths.tests)}
          </Text>
          {"  "}
          <Text underline color="whiteBright">
            {pad("Address", widths.address)}
          </Text>
          {"  "}
          <Text underline color="whiteBright">
            {padLeft("Raised", widths.balance)}
          </Text>
          {"  "}
          <Text underline color="whiteBright">
            {padLeft("Goal", widths.goal)}
          </Text>
          {"  "}
          <Text underline color="whiteBright">
            {"Progress  "}
          </Text>
          {"  "}
          <Text underline color="whiteBright">
            {pad("Funded", widths.funded)}
          </Text>
        </Text>

        {rows.map((r, i) => (
          <Text key={statuses[i].suiteId}>
            <Text color="whiteBright">{pad(r.name, widths.name)}</Text>
            {"  "}
            <Text color="gray">{padLeft(r.tests, widths.tests)}</Text>
            {"  "}
            <Text color="gray">{pad(r.address, widths.address)}</Text>
            {"  "}
            <Text color={r.progressPct >= 100 ? "green" : "yellow"}>
              {padLeft(r.balance, widths.balance)}
            </Text>
            {"  "}
            <Text color="gray">{padLeft(r.goal, widths.goal)}</Text>
            {"  "}
            <FundingProgressBar progress={statuses[i].fundingProgress} />
            {"  "}
            <Text color={statuses[i].isFunded ? "green" : "red"}>
              {pad(r.funded, widths.funded)}
            </Text>
          </Text>
        ))}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="gray">────────────────────────────────────────────────────────</Text>
        <Text>
          Summary:{" "}
          <Text color="green">${totalRaised.toFixed(2)}</Text>
          <Text color="gray"> / </Text>
          <Text color="white">${totalGoal.toFixed(2)}</Text>
          <Text color="gray"> raised</Text>
          {"  •  "}
          <Text color={fundedCount > 0 ? "green" : "yellow"}>
            {fundedCount}
          </Text>
          <Text color="gray">/{statuses.length} suites funded</Text>
        </Text>
      </Box>
    </Box>
  );
}

type Stage =
  | "menu"
  | "loadingFunding"
  | "showFunding"
  | "pickSuite"
  | "confirmUnfunded"
  | "version"
  | "selectModels"
  | "running"
  | "completed"
  | "publishing";

const App: React.FC = () => {
  const benchRoot = useBenchRoot();
  const testsDir = useMemo(() => join(benchRoot, "tests"), [benchRoot]);
  const { exit } = useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suites, setSuites] = useState<
    Array<{ filePath: string; suite: TestSuite; id: string }>
  >([]);
  const [fundingStatuses, setFundingStatuses] = useState<FundingStatus[]>([]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [version, setVersion] = useState<string>(formatDefaultVersion());
  const [stage, setStage] = useState<Stage>("menu");

  const [modelOrder, setModelOrder] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, ModelStats>>({});
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResultData | null>(null);
  const [publishedOutpoint, setPublishedOutpoint] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Model selection - all models enabled by default
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    () => new Set(modelsToRun.map((m) => m.name))
  );
  const [modelCursor, setModelCursor] = useState(0);
  // Track if user has interacted with model selection (prevents accidental immediate start)
  const [modelSelectionReady, setModelSelectionReady] = useState(false);

  // Cache status for showing resume capability
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  // Cache statuses for all suites (shown in suite picker)
  const [allCacheStatuses, setAllCacheStatuses] = useState<Map<string, CacheStatus>>(new Map());

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const found = await findTestSuites(testsDir);
        setSuites(found);
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    })();
  }, [testsDir]);

  // Load funding status when entering that stage
  useEffect(() => {
    if (stage === "loadingFunding") {
      (async () => {
        try {
          const statuses = await getAllFundingStatus();
          setFundingStatuses(statuses);
          setStage("showFunding");
        } catch (e) {
          setError((e as Error).message);
        }
      })();
    }
  }, [stage]);

  // Load cache status when entering selectModels stage
  useEffect(() => {
    if (stage === "selectModels" && selectedIndex != null) {
      // Reset ready state so user must interact before starting
      setModelSelectionReady(false);
      (async () => {
        const entry = suites[selectedIndex];
        const status = await getCacheStatus(
          entry.id,
          version,
          entry.suite.tests.length
        );
        setCacheStatus(status);
      })();
    }
  }, [stage, selectedIndex, version, suites]);

  // Run benchmark
  useEffect(() => {
    if (stage === "running" && selectedIndex != null) {
      (async () => {
        const entry = suites[selectedIndex];
        const suite = await loadSuiteFromFile(entry.filePath);

        // Track stats locally to avoid stale closure issues
        let localModelOrder: string[] = [];
        let localStats: Record<string, ModelStats> = {};

        // Filter models based on selection
        const activeModels = modelsToRun.filter((m) => selectedModels.has(m.name));

        await testRunner({
          suite,
          suiteFilePath: entry.filePath,
          version,
          silent: true,
          models: activeModels,
          onEvent: (event: RunnerEvent) => {
            if (event.type === "plan") {
              const order = Object.keys(event.totals);
              localModelOrder = order;
              localStats = order.reduce((acc, name) => {
                const t = event.totals[name];
                acc[name] = {
                  total: t.total,
                  executeTotal: t.execute,
                  reuseTotal: t.reuse,
                  reuseCompleted: 0,
                  executedStarted: 0,
                  executedDone: 0,
                  executedErrors: 0,
                  executedDurationSumMs: 0,
                  executedMaxDurationMs: 0,
                  correctCount: 0,
                  incorrectCount: 0,
                  costSum: 0,
                  completionTokensSum: 0,
                };
                return acc;
              }, {} as Record<string, ModelStats>);
              setModelOrder(order);
              setStats(localStats);
            } else if (event.type === "start") {
              localStats[event.model] = {
                ...localStats[event.model],
                executedStarted: localStats[event.model].executedStarted + 1,
              };
              setStats((prev) => ({
                ...prev,
                [event.model]: localStats[event.model],
              }));
            } else if (event.type === "done") {
              localStats[event.model] = {
                ...localStats[event.model],
                executedDone: localStats[event.model].executedDone + 1,
                executedDurationSumMs:
                  localStats[event.model].executedDurationSumMs + event.duration,
                executedMaxDurationMs: Math.max(
                  localStats[event.model].executedMaxDurationMs,
                  event.duration
                ),
                correctCount:
                  localStats[event.model].correctCount + (event.correct ? 1 : 0),
                incorrectCount:
                  localStats[event.model].incorrectCount + (!event.correct ? 1 : 0),
                costSum: localStats[event.model].costSum + (event.cost || 0),
                completionTokensSum:
                  localStats[event.model].completionTokensSum +
                  (event.completionTokens || 0),
              };
              setStats((prev) => ({
                ...prev,
                [event.model]: localStats[event.model],
              }));
            } else if (event.type === "error") {
              localStats[event.model] = {
                ...localStats[event.model],
                executedErrors: localStats[event.model].executedErrors + 1,
                executedDurationSumMs:
                  localStats[event.model].executedDurationSumMs + event.duration,
                executedMaxDurationMs: Math.max(
                  localStats[event.model].executedMaxDurationMs,
                  event.duration
                ),
              };
              setStats((prev) => ({
                ...prev,
                [event.model]: localStats[event.model],
              }));
            } else if (event.type === "reuse") {
              localStats[event.model] = {
                ...localStats[event.model],
                reuseCompleted: localStats[event.model].reuseCompleted + 1,
                executedDurationSumMs:
                  localStats[event.model].executedDurationSumMs +
                  (event.duration || 0),
                executedMaxDurationMs: Math.max(
                  localStats[event.model].executedMaxDurationMs,
                  event.duration || 0
                ),
                correctCount:
                  localStats[event.model].correctCount + (event.correct ? 1 : 0),
                incorrectCount:
                  localStats[event.model].incorrectCount + (!event.correct ? 1 : 0),
                costSum: localStats[event.model].costSum + (event.cost || 0),
                completionTokensSum:
                  localStats[event.model].completionTokensSum +
                  (event.completionTokens || 0),
              };
              setStats((prev) => ({
                ...prev,
                [event.model]: localStats[event.model],
              }));
            }
          },
        });

        // Build results data for publishing using local accumulators
        const suiteEntry = suites[selectedIndex];
        const resultsData: BenchmarkResultData = {
          suiteId: suiteEntry.id,
          suiteName: suiteEntry.suite.name,
          chain: suiteEntry.suite.chain || "unknown",
          version,
          timestamp: new Date().toISOString(),
          rankings: localModelOrder.map((model) => {
            const s = localStats[model];
            const answered = s ? s.correctCount + s.incorrectCount : 0;
            return {
              model,
              correct: s?.correctCount || 0,
              incorrect: s?.incorrectCount || 0,
              errors: s?.executedErrors || 0,
              totalTests: s?.total || 0,
              successRate: answered > 0 ? (s!.correctCount / answered) * 100 : 0,
              totalCost: s?.costSum || 0,
              tokensPerSecond:
                s && s.executedDurationSumMs > 0
                  ? s.completionTokensSum / (s.executedDurationSumMs / 1000)
                  : 0,
            };
          }).sort((a, b) => b.successRate - a.successRate),
          metadata: {
            totalModels: localModelOrder.length,
            totalTestsRun: Object.values(localStats).reduce((sum, s) => sum + s.total, 0),
            overallSuccessRate: (() => {
              const total = Object.values(localStats).reduce(
                (sum, s) => sum + s.correctCount + s.incorrectCount,
                0
              );
              const correct = Object.values(localStats).reduce(
                (sum, s) => sum + s.correctCount,
                0
              );
              return total > 0 ? (correct / total) * 100 : 0;
            })(),
            totalCost: Object.values(localStats).reduce((sum, s) => sum + s.costSum, 0),
          },
        };
        setBenchmarkResults(resultsData);
        setStage("completed");
      })();
    }
  }, [stage, selectedIndex, suites, version]);

  // Get funding status for selected suite
  const selectedFunding = useMemo(() => {
    if (selectedIndex == null) return null;
    const suiteId = suites[selectedIndex]?.id;
    return fundingStatuses.find((f) => f.suiteId === suiteId);
  }, [selectedIndex, suites, fundingStatuses]);

  // Version input keyboard handling (for escape to go back)
  useInput(
    (input, key) => {
      if (stage !== "version") return;
      if (key.escape) {
        setStage("pickSuite");
      }
    },
    { isActive: stage === "version" }
  );

  // Model selection keyboard handling
  useInput(
    (input, key) => {
      if (stage !== "selectModels") return;

      if (key.escape) {
        setCacheStatus(null);
        setStage("version");
      } else if (key.upArrow) {
        setModelCursor((c) => (c > 0 ? c - 1 : modelsToRun.length - 1));
        setModelSelectionReady(true);
      } else if (key.downArrow) {
        setModelCursor((c) => (c < modelsToRun.length - 1 ? c + 1 : 0));
        setModelSelectionReady(true);
      } else if (input === " ") {
        const modelName = modelsToRun[modelCursor].name;
        setSelectedModels((prev) => {
          const next = new Set(prev);
          if (next.has(modelName)) {
            next.delete(modelName);
          } else {
            next.add(modelName);
          }
          return next;
        });
        setModelSelectionReady(true);
      } else if (input === "a") {
        setSelectedModels(new Set(modelsToRun.map((m) => m.name)));
        setModelSelectionReady(true);
      } else if (input === "n") {
        setSelectedModels(new Set());
        setModelSelectionReady(true);
      } else if (input === "s" || input === "S") {
        // Explicit 's' to start - always works if models selected
        if (selectedModels.size > 0) {
          setStage("running");
        }
      } else if (key.return && selectedModels.size > 0 && modelSelectionReady) {
        // Enter only works after user has interacted with the selection
        setStage("running");
      }
    },
    { isActive: stage === "selectModels" }
  );

  // Handle publishing effect - must be before conditional returns
  useEffect(() => {
    if (stage !== "publishing" || !benchmarkResults || publishedOutpoint || publishError) {
      return;
    }

    (async () => {
      try {
        const result = await publishResults(benchmarkResults, { silent: true });
        setPublishedOutpoint(result.outpoint);

        // Save outpoint to a file alongside results
        const entry = suites[selectedIndex!];
        const resultsDir = join(
          dirname(entry.filePath),
          "..",
          "results",
          entry.id,
          version
        );

        // Ensure results directory exists
        await mkdir(resultsDir, { recursive: true });

        const outpointFile = join(
          resultsDir,
          `published-${result.txid.slice(0, 8)}.json`
        );
        await fsWriteFile(
          outpointFile,
          JSON.stringify(
            {
              txid: result.txid,
              vout: result.vout,
              outpoint: result.outpoint,
              publishedAt: new Date().toISOString(),
              suiteId: entry.id,
              version,
            },
            null,
            2
          ),
          "utf-8"
        );
      } catch (e) {
        setPublishError((e as Error).message);
      }
    })();
  }, [stage, benchmarkResults, publishedOutpoint, publishError, suites, selectedIndex, version]);

  if (loading) {
    return (
      <Box>
        <Text>Scanning tests…</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  // Main menu
  if (stage === "menu") {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          ╔═══════════════════════════════════════╗
        </Text>
        <Text bold color="cyan">
          ║         BITBENCH CLI v1.0.0          ║
        </Text>
        <Text bold color="cyan">
          ╚═══════════════════════════════════════╝
        </Text>
        <Box marginTop={1}>
          <Text>What would you like to do?</Text>
        </Box>
        <SelectInput
          items={[
            {
              key: "funding",
              value: "funding",
              label: "📊 View Funding Status",
            },
            { key: "run", value: "run", label: "🚀 Run Benchmark" },
            { key: "exit", value: "exit", label: "❌ Exit" },
          ]}
          onSelect={(item: any) => {
            if (item.value === "funding") {
              setStage("loadingFunding");
            } else if (item.value === "run") {
              // Load funding info and cache statuses before showing suite picker
              (async () => {
                const statuses = await getAllFundingStatus();
                setFundingStatuses(statuses);

                // Load cache statuses for all suites with today's version
                const cacheMap = new Map<string, CacheStatus>();
                const todayVersion = formatDefaultVersion();
                for (const suite of suites) {
                  const status = await getCacheStatus(
                    suite.id,
                    todayVersion,
                    suite.suite.tests.length
                  );
                  if (status.cachedResults > 0) {
                    cacheMap.set(suite.id, status);
                  }
                }
                setAllCacheStatuses(cacheMap);

                setStage("pickSuite");
              })();
            } else {
              exit();
            }
          }}
        />
        {!isMasterWifConfigured() && (
          <Box marginTop={1}>
            <Text color="yellow">
              ⚠ MASTER_WIF not set. Add to .env to see funding addresses.
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // Loading funding status
  if (stage === "loadingFunding") {
    return (
      <Box>
        <Text color="cyan">Checking balances via WhatsOnChain...</Text>
      </Box>
    );
  }

  // Show funding status
  if (stage === "showFunding") {
    return (
      <Box flexDirection="column">
        <FundingTable statuses={fundingStatuses} />
        <Box marginTop={1}>
          <Text color="gray">Press any key to return to menu...</Text>
        </Box>
        <SelectInput
          items={[{ key: "back", value: "back", label: "← Back to Menu" }]}
          onSelect={() => setStage("menu")}
        />
      </Box>
    );
  }

  // Pick suite
  if (stage === "pickSuite") {
    if (suites.length === 0) {
      return (
        <Box flexDirection="column">
          <Text>No test suites found in {testsDir}</Text>
        </Box>
      );
    }

    type SuiteSelection = { type: "suite"; idx: number } | { type: "back"; idx: number };

    const suiteItems: Array<{ key: string; value: SuiteSelection; label: string }> = suites.map((s, idx) => {
      const funding = fundingStatuses.find((f) => f.suiteId === s.id);
      const isFunded = funding?.isFunded ?? false;
      const fundingProgress = funding
        ? Math.round(funding.fundingProgress * 100)
        : 0;
      const fundingIcon = isFunded ? "✓" : "✗";

      // Check for cached progress
      const cache = allCacheStatuses.get(s.id);
      const cacheProgress = cache ? Math.round(cache.progress * 100) : 0;
      const hasCachedProgress = cache && cache.cachedResults > 0;

      // Build label with cache status if applicable
      let label = `[${fundingIcon} ${fundingProgress}%] ${s.suite.name}`;
      if (hasCachedProgress) {
        label += ` ⏸ ${cacheProgress}% cached`;
      }
      if (s.suite.description) {
        label += ` — ${s.suite.description}`;
      }

      return {
        key: String(idx),
        value: { type: "suite" as const, idx },
        label,
      };
    });

    // Add back option at the end
    const items: Array<{ key: string; value: SuiteSelection; label: string }> = [
      ...suiteItems,
      { key: "back", value: { type: "back" as const, idx: -1 }, label: "← Back to Menu" },
    ];

    return (
      <Box flexDirection="column">
        <Text>Select a test suite:</Text>
        <SelectInput
          items={items}
          onSelect={(item: any) => {
            const selection = item.value as { type: "suite" | "back"; idx: number };

            if (selection.type === "back") {
              setStage("menu");
              return;
            }

            const idx = selection.idx;
            setSelectedIndex(idx);

            const funding = fundingStatuses.find(
              (f) => f.suiteId === suites[idx].id
            );

            // Check if funded or force flag is set
            if (funding?.isFunded || FORCE_RUN) {
              setStage("version");
            } else {
              setStage("confirmUnfunded");
            }
          }}
        />
        <Box marginTop={1}>
          <Text color="gray">
            Tip: Use --force flag to bypass funding check
          </Text>
        </Box>
      </Box>
    );
  }

  // Confirm running unfunded suite
  if (stage === "confirmUnfunded") {
    const funding = selectedFunding;

    return (
      <Box flexDirection="column">
        <Text bold color="yellow">
          ⚠️ WARNING: Suite Not Fully Funded
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text>
            Suite: <Text color="whiteBright">{suites[selectedIndex!]?.suite.name}</Text>
          </Text>
          <Text>
            Funding:{" "}
            <Text color="yellow">
              ${funding?.balanceUsd.toFixed(2) ?? "0.00"}
            </Text>{" "}
            / <Text color="white">${funding?.goalUsd.toFixed(2) ?? "--"}</Text>
            {" ("}
            <Text color="yellow">
              {Math.round((funding?.fundingProgress ?? 0) * 100)}%
            </Text>
            {")"}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>Do you want to run this benchmark anyway?</Text>
        </Box>
        <SelectInput
          items={[
            { key: "no", value: "no", label: "❌ No, go back" },
            { key: "yes", value: "yes", label: "✓ Yes, run anyway" },
          ]}
          onSelect={(item: any) => {
            if (item.value === "yes") {
              setStage("version");
            } else {
              setStage("pickSuite");
            }
          }}
        />
      </Box>
    );
  }

  // Version input
  if (stage === "version") {
    return (
      <Box flexDirection="column">
        <Text>Version label (press Enter to continue):</Text>
        <Box marginTop={1}>
          <TextInput
            value={version}
            onChange={setVersion}
            onSubmit={() => setStage("selectModels")}
          />
        </Box>
        <Box marginTop={1}>
          <Text color="gray">[Esc] go back</Text>
        </Box>
      </Box>
    );
  }

  // Model selection
  if (stage === "selectModels") {
    const selectedCount = selectedModels.size;
    const numTests = suites[selectedIndex!]?.suite.tests.length ?? 0;
    const totalExecutions = selectedCount * numTests * TEST_RUNS_PER_MODEL;
    const estimatedCost = estimateBenchmarkCost(
      Array.from(selectedModels),
      numTests,
      TEST_RUNS_PER_MODEL
    );

    const cacheProgress = cacheStatus ? Math.round(cacheStatus.progress * 100) : 0;
    const hasCachedProgress = cacheStatus && cacheStatus.cachedResults > 0;

    return (
      <Box flexDirection="column">
        {/* Cache status banner */}
        {hasCachedProgress && (
          <Box marginBottom={1} flexDirection="column">
            <Text bold color={cacheStatus.canResume ? "yellow" : "green"}>
              {cacheStatus.canResume
                ? `⏸ Cached Progress: ${cacheProgress}% (${cacheStatus.cachedResults}/${cacheStatus.totalExpected} results)`
                : `✓ Complete: ${cacheStatus.cachedResults} cached results`}
            </Text>
            {cacheStatus.canResume && (
              <Text color="yellow">
                Run will resume from where it left off — existing results will be reused
              </Text>
            )}
          </Box>
        )}

        <Text bold color="cyan">
          Select models to run ({selectedCount}/{modelsToRun.length} selected)
        </Text>
        <Text color="gray">
          {numTests} tests × {TEST_RUNS_PER_MODEL} runs = {totalExecutions.toLocaleString()} executions
        </Text>
        <Text color="green" bold>
          Estimated cost: ${estimatedCost.toFixed(2)}
          {hasCachedProgress && cacheStatus.canResume && (
            <Text color="yellow"> (reduced due to cache)</Text>
          )}
        </Text>
        <Text color="gray">
          [↑↓] navigate • [Space] toggle • [a] all • [n] none • [s] start • [Esc] back
        </Text>
        <Box marginTop={1} flexDirection="column">
          {modelsToRun.map((model, idx) => {
            const isSelected = selectedModels.has(model.name);
            const isCursor = idx === modelCursor;
            const costPerTest = model.avgCostPerTest ?? 0.01;
            const modelCost = costPerTest * numTests * TEST_RUNS_PER_MODEL;
            return (
              <Text key={model.name}>
                <Text color={isCursor ? "cyan" : "white"}>
                  {isCursor ? ">" : " "}
                </Text>
                <Text color={isSelected ? "green" : "red"}>
                  {isSelected ? " ✓ " : " ✗ "}
                </Text>
                <Text color={isSelected ? "white" : "gray"}>
                  {model.name}
                </Text>
                <Text color="gray"> ${modelCost.toFixed(2)}</Text>
                {model.reasoning && <Text color="yellow"> (reasoning)</Text>}
              </Text>
            );
          })}
        </Box>
        <Box marginTop={1}>
          <Text color={selectedCount > 0 ? "green" : "red"}>
            {selectedCount > 0
              ? `Press [s] to start benchmark (~$${estimatedCost.toFixed(2)})`
              : "Select at least one model to continue"}
          </Text>
        </Box>
      </Box>
    );
  }

  // Running benchmark
  if (stage === "running") {
    const picked = selectedIndex != null ? suites[selectedIndex] : null;

    const totals = modelOrder.reduce(
      (acc, name) => {
        const s = stats[name];
        if (!s) return acc;
        acc.total += s.total;
        acc.completed += s.reuseCompleted + s.executedDone + s.executedErrors;
        acc.errors += s.executedErrors;
        acc.running += Math.max(
          0,
          s.executedStarted - s.executedDone - s.executedErrors
        );
        acc.correct += s.correctCount;
        acc.incorrect += s.incorrectCount;
        acc.durationSumMs += s.executedDurationSumMs;
        acc.durationDenom +=
          s.reuseCompleted + s.executedDone + s.executedErrors;
        acc.costSum += s.costSum;
        acc.costDenom += s.reuseCompleted + s.executedDone;
        acc.completionTokensSum += s.completionTokensSum;
        acc.tokensDenom += s.reuseCompleted + s.executedDone;
        return acc;
      },
      {
        total: 0,
        completed: 0,
        errors: 0,
        running: 0,
        correct: 0,
        incorrect: 0,
        durationSumMs: 0,
        durationDenom: 0,
        costSum: 0,
        costDenom: 0,
        completionTokensSum: 0,
        tokensDenom: 0,
      }
    );

    const header = [
      "Model",
      "Tests",
      "% Right",
      "Errors",
      "Running Tests",
      "Avg Cost",
      "Avg Tokens",
      "TPS",
      "Avg Duration",
      "Slowest",
    ];

    const rows = modelOrder.map((name) => {
      const s = stats[name];
      const completed = s ? s.reuseCompleted + s.executedDone : 0;
      const denom = s ? s.total : 0;
      const err = s ? s.executedErrors : 0;
      const run = s
        ? Math.max(0, s.executedStarted - s.executedDone - s.executedErrors)
        : 0;
      const answered = s ? s.correctCount + s.incorrectCount : 0;
      const pct =
        answered > 0 ? Math.round((s!.correctCount / answered) * 100) : null;
      const avgCount = s
        ? s.reuseCompleted + s.executedDone + s.executedErrors
        : 0;
      const avgSec =
        avgCount > 0 ? s!.executedDurationSumMs / avgCount / 1000 : null;
      const slowSec =
        s && s.executedMaxDurationMs > 0 ? s.executedMaxDurationMs / 1000 : null;
      const costDenom = s ? s.reuseCompleted + s.executedDone : 0;
      const avgCost = costDenom > 0 ? s!.costSum / costDenom : null;
      const tokensDenom = s ? s.reuseCompleted + s.executedDone : 0;
      const avgTokens =
        tokensDenom > 0
          ? Math.round(s!.completionTokensSum / tokensDenom)
          : null;
      const tpsDurationSec = s ? s.executedDurationSumMs / 1000 : 0;
      const tps =
        tpsDurationSec > 0 ? s!.completionTokensSum / tpsDurationSec : null;
      return {
        model: name,
        done: `${completed}/${denom}`,
        correct: pct === null ? "-" : `${pct}%`,
        err: err === 0 ? "-" : String(err),
        run: run === 0 ? "-" : String(run),
        avgCost: avgCost === null ? "-" : `$${avgCost.toFixed(4)}`,
        avgTokens: avgTokens === null ? "-" : avgTokens.toLocaleString(),
        tps: tps === null ? "-" : tps.toFixed(1),
        avg: avgSec === null ? "-" : `${avgSec.toFixed(2)}s`,
        slow: slowSec === null ? "-" : `${slowSec.toFixed(2)}s`,
        pct,
      };
    });

    const widths = {
      model: Math.max(header[0].length, ...rows.map((r) => r.model.length)),
      done: Math.max(header[1].length, ...rows.map((r) => r.done.length)),
      correct: Math.max(header[2].length, ...rows.map((r) => r.correct.length)),
      err: Math.max(header[3].length, ...rows.map((r) => r.err.length)),
      run: Math.max(header[4].length, ...rows.map((r) => r.run.length)),
      avgCost: Math.max(header[5].length, ...rows.map((r) => r.avgCost.length)),
      avgTokens: Math.max(
        header[6].length,
        ...rows.map((r) => r.avgTokens.length)
      ),
      tps: Math.max(header[7].length, ...rows.map((r) => r.tps.length)),
      avg: Math.max(header[8].length, ...rows.map((r) => r.avg.length)),
      slow: Math.max(header[9].length, ...rows.map((r) => r.slow.length)),
    };

    const overallAnswered = totals.correct + totals.incorrect;
    const overallPct =
      overallAnswered > 0
        ? Math.round((totals.correct / overallAnswered) * 100)
        : null;
    const overallAvgSec =
      totals.durationDenom > 0
        ? totals.durationSumMs / totals.durationDenom / 1000
        : null;

    return (
      <Box flexDirection="column">
        <Text>
          Running <Text color="magentaBright">{picked?.suite.name}</Text> @
          version <Text color="cyan">{version}</Text>…
        </Text>

        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text underline color="whiteBright">
              {pad(header[0], widths.model)}
            </Text>
            {"  "}
            <Text underline color="whiteBright">
              {pad(header[1], widths.done)}
            </Text>
            {"  "}
            <Text underline color="whiteBright">
              {pad(header[2], widths.correct)}
            </Text>
            {"  "}
            <Text underline color="whiteBright">
              {pad(header[3], widths.err)}
            </Text>
            {"  "}
            <Text underline color="whiteBright">
              {pad(header[4], widths.run)}
            </Text>
            {"  "}
            <Text underline color="whiteBright">
              {pad(header[5], widths.avgCost)}
            </Text>
            {"  "}
            <Text underline color="whiteBright">
              {pad(header[6], widths.avgTokens)}
            </Text>
            {"  "}
            <Text underline color="whiteBright">
              {pad(header[7], widths.tps)}
            </Text>
            {"  "}
            <Text underline color="whiteBright">
              {pad(header[8], widths.avg)}
            </Text>
            {"  "}
            <Text underline color="whiteBright">
              {pad(header[9], widths.slow)}
            </Text>
          </Text>
          {rows.map((r) => (
            <Text key={r.model}>
              <Text color="whiteBright">{pad(r.model, widths.model)}</Text>
              {"  "}
              <Text color="white">{padLeft(r.done, widths.done)}</Text>
              {"  "}
              <Text color={r.pct == null ? "gray" : pctColor(r.pct)}>
                {padLeft(r.correct, widths.correct)}
              </Text>
              {"  "}
              <Text color={r.err === "-" ? "gray" : "red"}>
                {padLeft(r.err, widths.err)}
              </Text>
              {"  "}
              <Text color={r.run === "-" ? "gray" : "yellow"}>
                {padLeft(r.run, widths.run)}
              </Text>
              {"  "}
              <Text color={r.avgCost === "-" ? "gray" : "green"}>
                {padLeft(r.avgCost, widths.avgCost)}
              </Text>
              {"  "}
              <Text color={r.avgTokens === "-" ? "gray" : "blue"}>
                {padLeft(r.avgTokens, widths.avgTokens)}
              </Text>
              {"  "}
              <Text color={r.tps === "-" ? "gray" : "blueBright"}>
                {padLeft(r.tps, widths.tps)}
              </Text>
              {"  "}
              <Text color={r.avg === "-" ? "gray" : "cyan"}>
                {padLeft(r.avg, widths.avg)}
              </Text>
              {"  "}
              <Text color={r.slow === "-" ? "gray" : "magenta"}>
                {padLeft(r.slow, widths.slow)}
              </Text>
            </Text>
          ))}
        </Box>

        <Box marginTop={1}>
          <ProgressBar completed={totals.completed} total={totals.total} />
        </Box>
        <Box marginTop={1}>
          <Text>
            Overall: <Text color="green">{totals.completed}</Text>/
            <Text color="white">{totals.total}</Text> done •{" "}
            <Text color={overallPct == null ? "gray" : pctColor(overallPct)}>
              {overallPct == null ? "-" : `${overallPct}%`}
            </Text>{" "}
            correct • <Text color="red">{totals.errors || "-"}</Text> errors •{" "}
            <Text color="yellow">{totals.running || "-"}</Text> running •{" "}
            <Text color={overallAvgSec == null ? "gray" : "cyan"}>
              {overallAvgSec == null ? "-" : `${overallAvgSec.toFixed(2)}s`}
            </Text>{" "}
            avg duration •{" "}
            <Text color="green">${totals.costSum.toFixed(4)}</Text> total cost
          </Text>
        </Box>
      </Box>
    );
  }

  // Benchmark completed - ask about publishing
  if (stage === "completed") {
    const canPublish = isPublishingConfigured();

    return (
      <Box flexDirection="column">
        <Text bold color="green">
          ╔═══════════════════════════════════════╗
        </Text>
        <Text bold color="green">
          ║       BENCHMARK COMPLETED!            ║
        </Text>
        <Text bold color="green">
          ╚═══════════════════════════════════════╝
        </Text>

        {benchmarkResults && (
          <Box marginTop={1} flexDirection="column">
            <Text>
              Suite: <Text color="cyan">{benchmarkResults.suiteName}</Text>
            </Text>
            <Text>
              Chain: <Text color="yellow">{benchmarkResults.chain.toUpperCase()}</Text>
            </Text>
            <Text>
              Version: <Text color="magenta">{benchmarkResults.version}</Text>
            </Text>
            <Text>
              Models tested: <Text color="white">{benchmarkResults.metadata.totalModels}</Text>
            </Text>
            <Text>
              Overall accuracy:{" "}
              <Text color={benchmarkResults.metadata.overallSuccessRate >= 70 ? "green" : "yellow"}>
                {benchmarkResults.metadata.overallSuccessRate.toFixed(1)}%
              </Text>
            </Text>
            <Text>
              Total cost: <Text color="green">${benchmarkResults.metadata.totalCost.toFixed(4)}</Text>
            </Text>
          </Box>
        )}

        <Box marginTop={1}>
          {canPublish ? (
            <Text>Would you like to publish results to the blockchain?</Text>
          ) : (
            <Text color="yellow">
              ⚠ MASTER_WIF not set - cannot publish to blockchain
            </Text>
          )}
        </Box>

        <SelectInput
          items={
            canPublish
              ? [
                  { key: "publish", value: "publish", label: "📜 Publish to blockchain" },
                  { key: "skip", value: "skip", label: "⏭ Skip publishing" },
                ]
              : [{ key: "exit", value: "exit", label: "✓ Done" }]
          }
          onSelect={(item: any) => {
            if (item.value === "publish") {
              setStage("publishing");
            } else {
              exit();
            }
          }}
        />
      </Box>
    );
  }

  // Publishing results to blockchain
  if (stage === "publishing") {
    if (publishError) {
      return (
        <Box flexDirection="column">
          <Text bold color="red">
            Publishing failed!
          </Text>
          <Text color="red">{publishError}</Text>
          <Box marginTop={1}>
            <SelectInput
              items={[{ key: "exit", value: "exit", label: "✓ Done" }]}
              onSelect={() => exit()}
            />
          </Box>
        </Box>
      );
    }

    if (publishedOutpoint) {
      const txid = publishedOutpoint.split("_")[0];
      return (
        <Box flexDirection="column">
          <Text bold color="green">
            ╔═══════════════════════════════════════╗
          </Text>
          <Text bold color="green">
            ║      PUBLISHED TO BLOCKCHAIN!         ║
          </Text>
          <Text bold color="green">
            ╚═══════════════════════════════════════╝
          </Text>

          <Box marginTop={1} flexDirection="column">
            <Text>
              Outpoint: <Text color="cyan">{publishedOutpoint}</Text>
            </Text>
            <Text>
              View: <Text color="blue">https://whatsonchain.com/tx/{txid}</Text>
            </Text>
          </Box>

          <Box marginTop={1}>
            <SelectInput
              items={[{ key: "exit", value: "exit", label: "✓ Done" }]}
              onSelect={() => exit()}
            />
          </Box>
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        <Text color="cyan">Publishing to blockchain...</Text>
        <Text color="gray">Creating 1sat ordinal with benchmark results...</Text>
      </Box>
    );
  }

  return null;
};

render(<App />, { stdin, stdout, stderr });
