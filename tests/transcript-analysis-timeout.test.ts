import { describe, expect, it, vi } from "vitest";

/**
 * Regression coverage: the OpenRouter chat-completion call must carry an
 * explicit, bounded timeout. Without one it inherits the SDK's 10-minute
 * default, which — because the caller (the Fireflies webhook) has already
 * marked its webhook_events row "processing" before this call — can leave
 * that row stuck in "processing" for up to 10 minutes past the platform's
 * own function timeout, unretriable until it expires.
 */
const createSpy = vi.fn().mockResolvedValue({
  choices: [{ message: { content: JSON.stringify({ summary: "ok", sentiment: "neutral", insights: [] }) } }],
});

vi.mock("@/lib/ai/openrouter", () => ({
  createOpenRouterClient: () => ({ chat: { completions: { create: createSpy } } }),
  openRouterModel: () => "test-model",
}));

const { analyzeTranscript } = await import("@/lib/ai/transcript-analysis");

describe("analyzeTranscript", () => {
  it("passes a bounded timeout to the OpenRouter chat-completion call", async () => {
    await analyzeTranscript("hello world", { title: "Test meeting", attendees: [] });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const [, options] = createSpy.mock.calls[0] as [unknown, { timeout?: number } | undefined];
    expect(options?.timeout).toBeTypeOf("number");
    expect(options?.timeout).toBeGreaterThan(0);
    // Bounded well under a typical serverless function timeout, not the
    // SDK's 10-minute (600_000ms) default.
    expect(options?.timeout).toBeLessThanOrEqual(120_000);
  });
});
