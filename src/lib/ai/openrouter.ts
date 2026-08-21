import OpenAI from "openai";

const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function openRouterModel() {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
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
