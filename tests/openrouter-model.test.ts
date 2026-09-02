import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/observability/logger";
import { openRouterModel } from "@/lib/ai/openrouter";

describe("openRouterModel", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("uses OPENROUTER_MODEL when set, without warning", () => {
    vi.stubEnv("OPENROUTER_MODEL", "anthropic/claude-sonnet-5");
    const warnSpy = vi.spyOn(logger, "warn");
    expect(openRouterModel()).toBe("anthropic/claude-sonnet-5");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to the free-tier default and warns when unset", () => {
    vi.stubEnv("OPENROUTER_MODEL", "");
    const warnSpy = vi.spyOn(logger, "warn");
    expect(openRouterModel()).toBe("nvidia/nemotron-3-ultra-550b-a55b:free");
    expect(warnSpy).toHaveBeenCalledWith("openrouter.default_model_in_use", { model: "nvidia/nemotron-3-ultra-550b-a55b:free" });
  });
});
