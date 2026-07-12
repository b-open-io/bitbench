/**
 * Frontier model set for ai-bitcoin-philosophy pilot + production publish.
 *
 * Policy: every model runs at **low** reasoning effort so rankings compare
 * models under the same effort level (not none vs low vs default).
 *
 * Grok 4.5 cannot disable reasoning; `low` is also its practical floor.
 * OpenAI / Claude / GLM accept `low` as a real low-effort thinking mode.
 *
 * Display names encode effort so the site shows what was measured.
 */
import {
  openrouter,
  type OpenRouterChatSettings,
} from "@openrouter/ai-sdk-provider";
import { defaultProviderOptions, type RunnableModel } from "./models.ts";

/** OpenRouter accepts more efforts than the SDK type lists. */
function effort(
  level: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
): OpenRouterChatSettings {
  return {
    ...defaultProviderOptions,
    reasoning: { effort: level } as OpenRouterChatSettings["reasoning"],
  };
}

export type PhilosophyModelSpec = {
  name: string;
  id: string;
  providerOptions: OpenRouterChatSettings;
  reasoning: boolean;
  effortLabel: string;
};

/** Apples-to-apples: all models at reasoning.effort = low. */
export const PHILOSOPHY_DEFAULT_MODELS: PhilosophyModelSpec[] = [
  {
    name: "grok-4.5-low",
    id: "x-ai/grok-4.5",
    providerOptions: effort("low"),
    reasoning: true,
    effortLabel: "low",
  },
  {
    name: "claude-sonnet-5-low",
    id: "anthropic/claude-sonnet-5",
    providerOptions: effort("low"),
    reasoning: true,
    effortLabel: "low",
  },
  {
    name: "gpt-5.6-sol-low",
    id: "openai/gpt-5.6-sol",
    providerOptions: effort("low"),
    reasoning: true,
    effortLabel: "low",
  },
  {
    name: "gpt-5.6-luna-low",
    id: "openai/gpt-5.6-luna",
    providerOptions: effort("low"),
    reasoning: true,
    effortLabel: "low",
  },
  {
    name: "glm-5.2-low",
    id: "z-ai/glm-5.2",
    providerOptions: effort("low"),
    reasoning: true,
    effortLabel: "low",
  },
];

/**
 * Build RunnableModels. SMOKE_MODELS=lab/id,lab/id overrides to bare defaults
 * (no effort) for ad-hoc debugging only.
 */
export function resolvePhilosophyModels(): {
  specs: PhilosophyModelSpec[];
  models: RunnableModel[];
} {
  const raw = process.env.SMOKE_MODELS?.trim();
  const specs: PhilosophyModelSpec[] = raw
    ? raw.split(",").map((entry) => {
        const id = entry.trim();
        if (!id.includes("/")) {
          throw new Error(`Model id must be lab/name, got: ${id}`);
        }
        const name = id.split("/").pop()!;
        return {
          name,
          id,
          providerOptions: defaultProviderOptions,
          reasoning: false,
          effortLabel: "default (SMOKE_MODELS override)",
        };
      })
    : PHILOSOPHY_DEFAULT_MODELS;

  const models: RunnableModel[] = specs.map((m) => ({
    name: m.name,
    id: m.id,
    llm: openrouter(m.id, m.providerOptions),
    reasoning: m.reasoning,
  }));

  return { specs, models };
}
