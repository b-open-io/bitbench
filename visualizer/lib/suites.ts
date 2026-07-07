import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { getDonationAddress, isMasterWifConfigured } from "./addresses"
import { getSuiteState, isRedisConfigured } from "./kv"
import { getBsvPriceUsd } from "./price"
import type {
  Chain,
  ModelRegistryEntry,
  SuiteRuntimeState,
  SuiteWithBalance,
  TestSuite,
  TestSuiteFile,
} from "./types"

// Path to test suite JSON files (source of truth)
const TESTS_DIR = join(process.cwd(), "..", "bench", "tests")
const MODELS_RESOLVED_PATH = join(
  process.cwd(),
  "..",
  "bench",
  "models-resolved.json",
)

interface ResolvedSuiteInfo {
  modelCount: number
  estimatedCostUsd: number
  models?: ModelRegistryEntry[]
}

interface ValidatedModelsResolvedSnapshot {
  generatedAt: string
  defaultModelCount: number
  defaultModels: ModelRegistryEntry[]
  suites: Record<string, ResolvedSuiteInfo>
}

let modelsResolvedSnapshot: Promise<ValidatedModelsResolvedSnapshot> | null =
  null

function isModelRegistryEntryArray(
  value: unknown,
): value is ModelRegistryEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (model) =>
        typeof model === "object" &&
        model !== null &&
        typeof (model as ModelRegistryEntry).name === "string" &&
        typeof (model as ModelRegistryEntry).id === "string",
    )
  )
}

async function loadModelsResolvedSnapshot(): Promise<ValidatedModelsResolvedSnapshot> {
  modelsResolvedSnapshot ??= (async () => {
    let content: string
    try {
      content = await readFile(MODELS_RESOLVED_PATH, "utf-8")
    } catch (error) {
      throw new Error(
        `Missing resolved model snapshot at ${MODELS_RESOLVED_PATH}. Run "cd bench && bun run models --write".`,
        { cause: error },
      )
    }

    const parsed = JSON.parse(content) as unknown
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(
        `Invalid resolved model snapshot at ${MODELS_RESOLVED_PATH}: expected object.`,
      )
    }

    const snapshot = parsed as {
      generatedAt?: unknown
      defaultModelCount?: unknown
      defaultModels?: unknown
      suites?: unknown
    }

    if (
      typeof snapshot.generatedAt !== "string" ||
      typeof snapshot.defaultModelCount !== "number" ||
      !isModelRegistryEntryArray(snapshot.defaultModels) ||
      typeof snapshot.suites !== "object" ||
      snapshot.suites === null
    ) {
      throw new Error(
        `Invalid resolved model snapshot at ${MODELS_RESOLVED_PATH}: expected generatedAt, defaultModelCount, defaultModels, and suites.`,
      )
    }

    if (snapshot.defaultModels.length !== snapshot.defaultModelCount) {
      throw new Error(
        `Invalid resolved model snapshot at ${MODELS_RESOLVED_PATH}: defaultModelCount does not match defaultModels length.`,
      )
    }

    const suites: Record<string, ResolvedSuiteInfo> = {}
    for (const [suiteId, value] of Object.entries(snapshot.suites)) {
      if (typeof value !== "object" || value === null) {
        throw new Error(
          `Invalid resolved model snapshot at ${MODELS_RESOLVED_PATH}: suite "${suiteId}" must be an object.`,
        )
      }

      const suite = value as {
        modelCount?: unknown
        estimatedCostUsd?: unknown
        models?: unknown
      }

      if (
        typeof suite.modelCount !== "number" ||
        typeof suite.estimatedCostUsd !== "number"
      ) {
        throw new Error(
          `Invalid resolved model snapshot at ${MODELS_RESOLVED_PATH}: suite "${suiteId}" is missing modelCount or estimatedCostUsd.`,
        )
      }

      if (
        suite.models !== undefined &&
        !isModelRegistryEntryArray(suite.models)
      ) {
        throw new Error(
          `Invalid resolved model snapshot at ${MODELS_RESOLVED_PATH}: suite "${suiteId}" models must be [{ name, id }].`,
        )
      }

      suites[suiteId] = {
        modelCount: suite.modelCount,
        estimatedCostUsd: suite.estimatedCostUsd,
        ...(suite.models ? { models: suite.models } : {}),
      }
    }

    return {
      generatedAt: snapshot.generatedAt,
      defaultModelCount: snapshot.defaultModelCount,
      defaultModels: snapshot.defaultModels,
      suites,
    }
  })()

  return modelsResolvedSnapshot
}

async function getResolvedSuiteInfo(
  suiteId: string,
): Promise<{ modelCount: number; estimatedCostUsd: number }> {
  const snapshot = await loadModelsResolvedSnapshot()
  const suite = snapshot.suites[suiteId]
  if (!suite) {
    throw new Error(
      `Resolved model snapshot ${MODELS_RESOLVED_PATH} has no entry for suite "${suiteId}". Run "cd bench && bun run models --write".`,
    )
  }
  return suite
}

export async function getDefaultModels(): Promise<ModelRegistryEntry[]> {
  const snapshot = await loadModelsResolvedSnapshot()
  return snapshot.defaultModels
}

export async function getSuiteModelInfo(suiteId: string): Promise<{
  modelCount: number
  models: ModelRegistryEntry[]
  usesDefaultModels: boolean
}> {
  const [snapshot, suiteFile] = await Promise.all([
    loadModelsResolvedSnapshot(),
    getSuiteFile(suiteId),
  ])

  if (!suiteFile) {
    throw new Error(`Suite "${suiteId}" does not exist.`)
  }

  const suite = snapshot.suites[suiteId]
  if (!suite) {
    throw new Error(
      `Resolved model snapshot ${MODELS_RESOLVED_PATH} has no entry for suite "${suiteId}". Run "cd bench && bun run models --write".`,
    )
  }

  const usesDefaultModels = !suiteFile.model_filter
  if (!usesDefaultModels && !suite.models) {
    throw new Error(
      `Resolved model snapshot ${MODELS_RESOLVED_PATH} suite "${suiteId}" has a model_filter but no models array. Run "cd bench && bun run models --write".`,
    )
  }

  const models = suite.models ?? snapshot.defaultModels
  if (models.length !== suite.modelCount) {
    throw new Error(
      `Resolved model snapshot ${MODELS_RESOLVED_PATH} suite "${suiteId}" modelCount does not match the resolved models length.`,
    )
  }

  return {
    modelCount: suite.modelCount,
    models,
    usesDefaultModels,
  }
}

/**
 * Load all test suite files from bench/tests/
 */
async function loadSuiteFiles(): Promise<TestSuiteFile[]> {
  const files = await readdir(TESTS_DIR)
  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  const suites: TestSuiteFile[] = []
  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(TESTS_DIR, file), "utf-8")
      const suite = JSON.parse(content) as TestSuiteFile
      if (suite.id && suite.name && Array.isArray(suite.tests)) {
        suites.push(suite)
      }
    } catch (error) {
      console.error(`Failed to load suite ${file}:`, error)
    }
  }

  // Sort by chain, then by name
  return suites.sort((a, b) => {
    if (a.chain !== b.chain) return a.chain.localeCompare(b.chain)
    return a.name.localeCompare(b.name)
  })
}

/**
 * Get runtime state for a suite from KV, with defaults
 */
async function getRuntimeState(suiteId: string): Promise<SuiteRuntimeState> {
  if (isRedisConfigured()) {
    const state = await getSuiteState(suiteId)
    if (state) return state
  }

  // Default state for suites without KV data
  return {
    lastRunAt: null,
    lastRunVersion: null,
    status: "funding",
  }
}

/**
 * Convert a suite file to a TestSuite with runtime data
 */
async function suiteFileToTestSuite(file: TestSuiteFile): Promise<TestSuite> {
  const state = await getRuntimeState(file.id)
  const resolved = await getResolvedSuiteInfo(file.id)

  return {
    id: file.id,
    name: file.name,
    description: file.description,
    version: file.version,
    testCount: file.tests.length,
    modelCount: resolved.modelCount,
    estimatedCostUsd: resolved.estimatedCostUsd,
    donationAddress: isMasterWifConfigured()
      ? getDonationAddress(file.id)
      : `placeholder-address-${file.id}`,
    lastRunAt: state.lastRunAt,
    lastRunVersion: state.lastRunVersion,
    status: state.status,
    chain: file.chain,
  }
}

/**
 * Get all suites with donation addresses and runtime state
 */
export async function getAllSuites(): Promise<TestSuite[]> {
  const files = await loadSuiteFiles()
  return Promise.all(files.map(suiteFileToTestSuite))
}

/**
 * Get a single suite by ID
 */
export async function getSuite(id: string): Promise<TestSuite | null> {
  const files = await loadSuiteFiles()
  const file = files.find((f) => f.id === id)
  if (!file) return null
  return suiteFileToTestSuite(file)
}

/**
 * Get suites filtered by chain
 */
export async function getSuitesByChain(chain: Chain): Promise<TestSuite[]> {
  const suites = await getAllSuites()
  return suites.filter((s) => s.chain === chain)
}

// WhatsOnChain API for balance checking
const WOC_API = "https://api.whatsonchain.com/v1/bsv/main"

interface WOCBalance {
  confirmed: number
  unconfirmed: number
}

/**
 * Get balance for a BSV address from WhatsOnChain
 */
export async function getAddressBalance(address: string): Promise<number> {
  // Skip for placeholder addresses
  if (address.startsWith("placeholder-")) {
    return 0
  }

  try {
    const res = await fetch(`${WOC_API}/address/${address}/balance`)
    if (!res.ok) {
      console.error(`WOC balance check failed: ${res.status}`)
      return 0
    }
    const data: WOCBalance = await res.json()
    return data.confirmed + data.unconfirmed
  } catch (error) {
    console.error("Failed to fetch balance:", error)
    return 0
  }
}

/**
 * Convert satoshis to USD
 */
export function satsToUsd(sats: number, priceUsd: number): number {
  return (sats / 100_000_000) * priceUsd
}

/**
 * Convert USD to satoshis
 */
export function usdToSats(usd: number, priceUsd: number): number {
  return Math.ceil((usd / priceUsd) * 100_000_000)
}

/**
 * Get suite with current balance information
 */
export async function getSuiteWithBalance(
  id: string,
): Promise<SuiteWithBalance | null> {
  const suite = await getSuite(id)
  if (!suite) return null

  const bsvPriceUsd = await getBsvPriceUsd()
  const balanceSats = await getAddressBalance(suite.donationAddress)
  const balanceUsd = satsToUsd(balanceSats, bsvPriceUsd)
  const goalSats = usdToSats(suite.estimatedCostUsd, bsvPriceUsd)

  return {
    ...suite,
    currentBalanceSats: balanceSats,
    currentBalanceUsd: balanceUsd,
    bsvPriceUsd,
    fundingProgress: goalSats > 0 ? Math.min(balanceSats / goalSats, 1) : 0,
  }
}

/**
 * Get full suite file by ID (includes tests array)
 */
export async function getSuiteFile(id: string): Promise<TestSuiteFile | null> {
  const files = await loadSuiteFiles()
  return files.find((f) => f.id === id) || null
}

/**
 * Get all suites with balance information
 */
export async function getAllSuitesWithBalance(): Promise<SuiteWithBalance[]> {
  const suites = await getAllSuites()
  const bsvPriceUsd = await getBsvPriceUsd()

  // Fetch balances in parallel
  const suitesWithBalance = await Promise.all(
    suites.map(async (suite) => {
      const balanceSats = await getAddressBalance(suite.donationAddress)
      const balanceUsd = satsToUsd(balanceSats, bsvPriceUsd)
      const goalSats = usdToSats(suite.estimatedCostUsd, bsvPriceUsd)

      return {
        ...suite,
        currentBalanceSats: balanceSats,
        currentBalanceUsd: balanceUsd,
        bsvPriceUsd,
        fundingProgress: goalSats > 0 ? Math.min(balanceSats / goalSats, 1) : 0,
      }
    }),
  )

  return suitesWithBalance
}
