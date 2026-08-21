import { z } from "zod";
import { createOpenRouterClient, openRouterModel } from "@/lib/ai/openrouter";

export const meetingInsightKind = z.enum([
  "summary",
  "buying_signal",
  "risk",
  "objection",
  "commitment",
  "decision",
]);

export const transcriptAnalysisSchema = z.object({
  summary: z.string().min(1),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  insights: z
    .array(
      z.object({
        kind: meetingInsightKind,
        content: z.string().min(1),
        evidenceQuote: z.string().optional(),
        evidenceTimestampSeconds: z.number().int().nonnegative().optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .max(12),
});

export type TranscriptAnalysis = z.infer<typeof transcriptAnalysisSchema>;

export class TranscriptAnalysisError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TranscriptAnalysisError";
  }
}

const SYSTEM_PROMPT = `You are a B2B sales meeting analyst for Armis Middle East. You will be given a meeting transcript.
Respond with ONLY a single JSON object matching this exact shape, no prose, no markdown fences:
{
  "summary": string,
  "sentiment": "positive" | "neutral" | "negative",
  "insights": Array<{
    "kind": "summary" | "buying_signal" | "risk" | "objection" | "commitment" | "decision",
    "content": string,
    "evidenceQuote"?: string,
    "evidenceTimestampSeconds"?: number,
    "confidence"?: number (0 to 1)
  }>
}
Keep "insights" to at most 12 items, ordered by importance. Only include an insight when the transcript actually supports it — do not invent facts.`;

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

export async function analyzeTranscript(
  transcript: string,
  context: { title: string; attendees: unknown },
): Promise<TranscriptAnalysis> {
  const client = createOpenRouterClient();
  if (!client) throw new TranscriptAnalysisError("OpenRouter is not configured");

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: openRouterModel(),
      max_tokens: 2048,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Meeting title: ${context.title}\nAttendees: ${JSON.stringify(context.attendees)}\n\nTranscript:\n${transcript}`,
        },
      ],
    });
  } catch (error) {
    throw new TranscriptAnalysisError("OpenRouter API request failed", error);
  }

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new TranscriptAnalysisError("OpenRouter response contained no text content");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJson(text));
  } catch (error) {
    throw new TranscriptAnalysisError("OpenRouter response was not valid JSON", error);
  }

  const parsed = transcriptAnalysisSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new TranscriptAnalysisError("OpenRouter response did not match the expected schema", parsed.error);
  }

  return parsed.data;
}
