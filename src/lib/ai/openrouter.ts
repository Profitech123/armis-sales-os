import OpenAI from "openai";
import { logger } from "@/lib/observability/logger";

// This is a free-tier OpenRouter model with tighter rate limits and latency
// than a paid tier — a reasonable default for local development, but not a
// deliberate production choice. It is not swapped here for a different
// default because that model choice belongs to whoever operates the AI
// transcript analysis pipeline (cost/quality tradeoff); instead,
// openRouterModel() warns loudly so the fallback can't ship to production
// unnoticed. Operators should set OPENROUTER_MODEL explicitly.
const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function openRouterModel() {
  const configured = process.env.OPENROUTER_MODEL;
  if (configured) return configured;
  logger.warn("openrouter.default_model_in_use", { model: DEFAULT_MODEL });
  return DEFAULT_MODEL;
}

export function createOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://armis-sales-os.vercel.app",
      "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "Armis Sales OS",
    },
  });
}
