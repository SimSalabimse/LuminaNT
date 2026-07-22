/**
 * D20 — closed AI model allowlist.
 * Settings dropdown + agent store reject free-form model IDs.
 */
import type { AiProvider } from "@/types";

export interface AiModelOption {
  id: string;
  label: string;
}

/** Closed set of models the UI may select per provider. */
export const AI_MODEL_ALLOWLIST: Record<AiProvider, AiModelOption[]> = {
  xai: [
    { id: "grok-2-latest", label: "Grok 2 (latest)" },
    { id: "grok-3", label: "Grok 3" },
    { id: "grok-3-mini", label: "Grok 3 mini" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  ],
};

export function defaultModelForProvider(provider: AiProvider): string {
  const list = AI_MODEL_ALLOWLIST[provider] || AI_MODEL_ALLOWLIST.xai;
  return list[0]?.id || "grok-2-latest";
}

export function isAllowedModel(provider: AiProvider, model: string): boolean {
  const id = (model || "").trim();
  if (!id) return false;
  return (AI_MODEL_ALLOWLIST[provider] || []).some((m) => m.id === id);
}

/**
 * Resolve a model string to an allowlisted id.
 * Empty / unknown → provider default (never pass free-form to the API).
 */
export function resolveAllowedModel(
  provider: AiProvider,
  model: string | undefined | null
): string {
  const id = (model || "").trim();
  if (id && isAllowedModel(provider, id)) return id;
  return defaultModelForProvider(provider);
}

/** Models for Settings Select (current provider only). */
export function modelsForProvider(provider: AiProvider): AiModelOption[] {
  return AI_MODEL_ALLOWLIST[provider] || AI_MODEL_ALLOWLIST.xai;
}
