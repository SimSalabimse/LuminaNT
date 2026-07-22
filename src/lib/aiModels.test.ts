import { describe, expect, it } from "vitest";
import {
  defaultModelForProvider,
  isAllowedModel,
  modelsForProvider,
  resolveAllowedModel,
} from "./aiModels";

describe("D20 model allowlist", () => {
  it("lists closed sets per provider", () => {
    expect(modelsForProvider("xai").length).toBeGreaterThan(0);
    expect(modelsForProvider("openai").some((m) => m.id === "gpt-4o-mini")).toBe(
      true
    );
    expect(
      modelsForProvider("anthropic").some((m) => m.id.includes("claude"))
    ).toBe(true);
  });

  it("accepts only allowlisted ids", () => {
    expect(isAllowedModel("xai", "grok-2-latest")).toBe(true);
    expect(isAllowedModel("xai", "evil-model-injected")).toBe(false);
    expect(isAllowedModel("openai", "gpt-4o")).toBe(true);
    expect(isAllowedModel("openai", "grok-2-latest")).toBe(false);
  });

  it("resolves empty / unknown to provider default", () => {
    expect(resolveAllowedModel("xai", "")).toBe(defaultModelForProvider("xai"));
    expect(resolveAllowedModel("xai", "not-a-real-model")).toBe(
      defaultModelForProvider("xai")
    );
    expect(resolveAllowedModel("openai", "gpt-4o-mini")).toBe("gpt-4o-mini");
  });
});
