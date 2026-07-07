import { readFile } from "fs/promises";
import { type LanguageModel } from "ai";
import {
  openrouter,
  type OpenRouterChatSettings,
} from "@openrouter/ai-sdk-provider";
import { type ReasoningEffort } from "openai/resources/shared";
import modelCostsData from "./model-costs.json";
import { TEST_RUNS_PER_MODEL } from "./constants";

const CATALOG_URL = "https://openrouter.ai/api/v1/models";

export interface ModelFilter {
  labs?: string[];
  max_age_days?: number;
  input_modalities?: string[];
  reasoning?: boolean;
  include?: string[];
  exclude?: string[];
  max_prompt_price_per_m?: number;
  max_completion_price_per_m?: number;
}

export interface CatalogModel {
  id: string;
  name: string;
  created: number;
  architecture: {
    modality?: string;
    input_modalities: string[];
    output_modalities: string[];
  };
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  supported_parameters?: string[];
}

export type RunnableModel = {
  name: string;
  id: string;
  llm: LanguageModel;
  reasoning?: boolean;
  /** Average or estimated cost per test execution in USD. */
  avgCostPerTest?: number;
  promptPriceUsd?: number;
  completionPriceUsd?: number;
};

type Variant = {
  suffix: string;
  name?: string;
  providerOptions: OpenRouterChatSettings;
  reasoning: boolean;
};

const measuredCosts: Record<string, number> = modelCostsData.costs;

export const defaultProviderOptions: OpenRouterChatSettings = {
  usage: {
    include: true,
  },
};

const withEffort = (
  effort: ReasoningEffort
): OpenRouterChatSettings["reasoning"] =>
  ({ effort } as unknown as OpenRouterChatSettings["reasoning"]);

export const VARIANTS: Record<string, Variant[]> = {
  "openai/gpt-5": [
    {
      suffix: "-minimal",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: withEffort("minimal"),
      },
      reasoning: true,
    },
    {
      suffix: "-default",
      providerOptions: defaultProviderOptions,
      reasoning: true,
    },
    {
      suffix: "-high",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: {
          effort: "high",
        },
      },
      reasoning: true,
    },
  ],
  "openai/gpt-5.1": [
    {
      suffix: "-low",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: {
          effort: "low",
        },
      },
      reasoning: true,
    },
    {
      suffix: "-default",
      providerOptions: defaultProviderOptions,
      reasoning: true,
    },
    {
      suffix: "-high",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: {
          effort: "high",
        },
      },
      reasoning: true,
    },
  ],
  "openai/gpt-5.2": [
    {
      suffix: "-none",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: withEffort("none"),
      },
      reasoning: false,
    },
    {
      suffix: "-xhigh",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: withEffort("xhigh"),
      },
      reasoning: true,
    },
    {
      suffix: "-high",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: {
          effort: "high",
        },
      },
      reasoning: true,
    },
  ],
  "deepseek/deepseek-chat-v3.1": [
    {
      suffix: "",
      name: "deepseek-v3.1",
      providerOptions: defaultProviderOptions,
      reasoning: false,
    },
    {
      suffix: "-thinking",
      name: "deepseek-v3.1-thinking",
      providerOptions: defaultProviderOptions,
      reasoning: true,
    },
  ],
  "anthropic/claude-sonnet-4": [
    {
      suffix: "",
      name: "claude-4-sonnet",
      providerOptions: defaultProviderOptions,
      reasoning: true,
    },
    {
      suffix: "-non-thinking",
      name: "claude-4-sonnet-non-thinking",
      providerOptions: defaultProviderOptions,
      reasoning: false,
    },
  ],
  "anthropic/claude-opus-4.5": [
    {
      suffix: "",
      name: "claude-4.5-opus",
      providerOptions: defaultProviderOptions,
      reasoning: true,
    },
    {
      suffix: "-thinking-high",
      name: "claude-4.5-opus-thinking-high",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: {
          effort: "high",
        },
      },
      reasoning: true,
    },
  ],
  "deepseek/deepseek-v3.2": [
    {
      suffix: "",
      providerOptions: defaultProviderOptions,
      reasoning: false,
    },
    {
      suffix: "-thinking-high",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: {
          effort: "high",
        },
      },
      reasoning: true,
    },
  ],
  "google/gemini-3-flash-preview": [
    {
      suffix: "-high",
      name: "gemini-3-flash-high",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: {
          effort: "high",
        },
      },
      reasoning: true,
    },
    {
      suffix: "-low",
      name: "gemini-3-flash-low",
      providerOptions: {
        ...defaultProviderOptions,
        reasoning: {
          effort: "low",
        },
      },
      reasoning: true,
    },
  ],
};

export const DEFAULT_FILTER: ModelFilter = {
  labs: [
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
  ],
  max_age_days: 365,
};

let catalogPromise: Promise<CatalogModel[]> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((item) => typeof item === "string")) return undefined;
  return value;
}

function validateCatalogModel(value: unknown, index: number): CatalogModel {
  if (!isRecord(value)) {
    throw new Error(`OpenRouter catalog entry ${index} is not an object`);
  }

  const architecture = value.architecture;
  if (!isRecord(architecture)) {
    throw new Error(`OpenRouter catalog entry ${index} has no architecture`);
  }

  const inputModalities = stringArray(architecture.input_modalities);
  const outputModalities = stringArray(architecture.output_modalities);
  if (!inputModalities || !outputModalities) {
    throw new Error(
      `OpenRouter catalog entry ${index} has invalid architecture modalities`
    );
  }

  const pricing = isRecord(value.pricing)
    ? {
        prompt:
          typeof value.pricing.prompt === "string"
            ? value.pricing.prompt
            : undefined,
        completion:
          typeof value.pricing.completion === "string"
            ? value.pricing.completion
            : undefined,
      }
    : undefined;

  const supportedParameters = stringArray(value.supported_parameters);

  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new Error(`OpenRouter catalog entry ${index} has invalid id`);
  }
  if (typeof value.name !== "string") {
    throw new Error(`OpenRouter catalog entry ${index} has invalid name`);
  }
  if (typeof value.created !== "number") {
    throw new Error(`OpenRouter catalog entry ${index} has invalid created`);
  }

  return {
    id: value.id,
    name: value.name,
    created: value.created,
    architecture: {
      modality:
        typeof architecture.modality === "string"
          ? architecture.modality
          : undefined,
      input_modalities: inputModalities,
      output_modalities: outputModalities,
    },
    pricing,
    supported_parameters: supportedParameters,
  };
}

function validateCatalogResponse(value: unknown): CatalogModel[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new Error("OpenRouter catalog response must be an object with data[]");
  }
  return value.data.map(validateCatalogModel);
}

export async function fetchCatalog(): Promise<CatalogModel[]> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const overridePath = process.env.OPENROUTER_CATALOG_FILE;
      if (overridePath) {
        console.warn(
          `WARNING: OPENROUTER_CATALOG_FILE is active; reading OpenRouter catalog from ${overridePath}`
        );
        const raw = await readFile(overridePath, "utf-8");
        return validateCatalogResponse(JSON.parse(raw) as unknown);
      }

      const res = await fetch(CATALOG_URL);
      if (!res.ok) {
        throw new Error(
          `OpenRouter catalog fetch failed: ${res.status} ${res.statusText}`
        );
      }

      return validateCatalogResponse((await res.json()) as unknown);
    })();
  }

  return catalogPromise;
}

function hasTextOnlyOutput(model: CatalogModel): boolean {
  const outputs = model.architecture.output_modalities;
  return outputs.length === 1 && outputs[0] === "text";
}

function supportsReasoning(model: CatalogModel): boolean {
  return model.supported_parameters?.includes("reasoning") ?? false;
}

function labFor(id: string): string {
  return id.split("/")[0] ?? id;
}

function baseNameFor(id: string): string {
  const slash = id.indexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

function pricePerMillion(price: string | undefined): number | undefined {
  if (price === undefined) return undefined;
  const parsed = Number(price);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed * 1_000_000;
}

function pricePerToken(price: string | undefined): number | undefined {
  if (price === undefined) return undefined;
  const parsed = Number(price);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function passesImplicitExclusions(model: CatalogModel): boolean {
  return !model.id.endsWith(":free") && hasTextOnlyOutput(model);
}

function passesFilter(
  model: CatalogModel,
  filter: Required<Pick<ModelFilter, "include" | "exclude">> & ModelFilter,
  nowMs: number
): boolean {
  if (!passesImplicitExclusions(model)) return false;
  if (filter.exclude.includes(model.id)) return false;
  if (filter.include.includes(model.id)) return true;

  if (filter.labs && !filter.labs.includes(labFor(model.id))) return false;

  if (filter.max_age_days !== undefined) {
    const cutoffMs = nowMs - filter.max_age_days * 24 * 60 * 60 * 1000;
    if (model.created * 1000 < cutoffMs) return false;
  }

  const requiredInputs = new Set(["text", ...(filter.input_modalities ?? [])]);
  for (const modality of requiredInputs) {
    if (!model.architecture.input_modalities.includes(modality)) return false;
  }

  if (
    filter.reasoning !== undefined &&
    supportsReasoning(model) !== filter.reasoning
  ) {
    return false;
  }

  const promptPerMillion = pricePerMillion(model.pricing?.prompt);
  if (
    filter.max_prompt_price_per_m !== undefined &&
    (promptPerMillion === undefined ||
      promptPerMillion > filter.max_prompt_price_per_m)
  ) {
    return false;
  }

  const completionPerMillion = pricePerMillion(model.pricing?.completion);
  if (
    filter.max_completion_price_per_m !== undefined &&
    (completionPerMillion === undefined ||
      completionPerMillion > filter.max_completion_price_per_m)
  ) {
    return false;
  }

  return true;
}

function labRank(labs: string[] | undefined, id: string): number {
  if (!labs) return Number.MAX_SAFE_INTEGER;
  const rank = labs.indexOf(labFor(id));
  return rank >= 0 ? rank : Number.MAX_SAFE_INTEGER;
}

function measuredCost(name: string): number | undefined {
  const cost = measuredCosts[name];
  return typeof cost === "number" && Number.isFinite(cost) ? cost : undefined;
}

export function estimateModelCostPerTest(model: RunnableModel): number {
  const measured = measuredCost(model.name);
  if (measured !== undefined) return measured;

  // model-costs.json stores dollars per completed test, not token counts, so
  // prompt/completion token medians are not derivable from the current data.
  const assumedPromptTokens = 2_000;
  const assumedCompletionTokens = 1_000;
  return (
    (model.promptPriceUsd ?? 0) * assumedPromptTokens +
    (model.completionPriceUsd ?? 0) * assumedCompletionTokens
  );
}

export function estimateBenchmarkCost(
  models: RunnableModel[],
  numTests: number,
  runsPerModel: number = TEST_RUNS_PER_MODEL
): number {
  return models.reduce(
    (sum, model) =>
      sum + estimateModelCostPerTest(model) * numTests * runsPerModel,
    0
  );
}

export function getModelCostPerTest(modelName: string): number {
  return measuredCosts[modelName] ?? 0.01;
}

export async function resolveModels(
  filter?: ModelFilter
): Promise<RunnableModel[]> {
  const catalog = await fetchCatalog();
  const mergedFilter = {
    ...DEFAULT_FILTER,
    ...filter,
    include: filter?.include ?? DEFAULT_FILTER.include ?? [],
    exclude: filter?.exclude ?? DEFAULT_FILTER.exclude ?? [],
  };
  const nowMs = Date.now();
  const selected = catalog
    .filter((model) => passesFilter(model, mergedFilter, nowMs))
    .sort((a, b) => {
      const labDiff =
        labRank(mergedFilter.labs, a.id) - labRank(mergedFilter.labs, b.id);
      if (labDiff !== 0) return labDiff;
      if (b.created !== a.created) return b.created - a.created;
      return a.id.localeCompare(b.id);
    });

  const baseNameCounts = new Map<string, number>();
  for (const model of selected) {
    const baseName = baseNameFor(model.id);
    baseNameCounts.set(baseName, (baseNameCounts.get(baseName) ?? 0) + 1);
  }

  const runnable: RunnableModel[] = [];
  for (const model of selected) {
    const baseName = baseNameFor(model.id);
    const displayName =
      (baseNameCounts.get(baseName) ?? 0) > 1 ? model.id : baseName;
    const promptPriceUsd = pricePerToken(model.pricing?.prompt);
    const completionPriceUsd = pricePerToken(model.pricing?.completion);
    const variants = VARIANTS[model.id];

    if (variants) {
      for (const variant of variants) {
        const name = variant.name ?? `${displayName}${variant.suffix}`;
        const entry: RunnableModel = {
          name,
          id: model.id,
          llm: openrouter(model.id, variant.providerOptions),
          reasoning: variant.reasoning,
          promptPriceUsd,
          completionPriceUsd,
        };
        entry.avgCostPerTest = estimateModelCostPerTest(entry);
        runnable.push(entry);
      }
      continue;
    }

    const entry: RunnableModel = {
      name: displayName,
      id: model.id,
      llm: openrouter(model.id, defaultProviderOptions),
      reasoning: supportsReasoning(model),
      promptPriceUsd,
      completionPriceUsd,
    };
    entry.avgCostPerTest = estimateModelCostPerTest(entry);
    runnable.push(entry);
  }

  return runnable;
}
