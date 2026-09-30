import "server-only"

import { ApiError, ThinkingLevel, type Part } from "@google/genai"

import { gemini, geminiModel } from "./client"
import { analysisPrompt, type AnalysisContext } from "./prompt"
import { analysisJsonSchema, analysisOutputSchema, type AnalysisOutput, type Vocabularies } from "./schema"

export type AnalysisInput =
  | { kind: "images"; images: { data: Uint8Array; mimeType: string }[] }
  | { kind: "youtube"; url: string }

/**
 * Error that should be retried later (rate limit, overload, transient network).
 * `pauseQueue` means every item would fail the same way (quota, billing, bad key),
 * so the worker should stop for a while instead of burning through the queue.
 */
export class RetryableAnalysisError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
    readonly pauseQueue: false | "rate_limit" | "billing" | "auth" = false,
  ) {
    super(message)
  }
}

/** Error that will not succeed on retry (bad input, blocked content). */
export class FatalAnalysisError extends Error {}

const YOUTUBE_CLIP_SECONDS = 90

export async function analyzeMedia(
  input: AnalysisInput,
  ctx: AnalysisContext,
  vocab: Vocabularies,
): Promise<{ output: AnalysisOutput; model: string }> {
  const model = geminiModel()
  const parts: Part[] = []

  if (input.kind === "youtube") {
    parts.push({
      fileData: { fileUri: input.url, mimeType: "video/*" },
      // Only the opening: keeps token use (and free-tier quota) predictable.
      videoMetadata: { startOffset: "0s", endOffset: `${YOUTUBE_CLIP_SECONDS}s`, fps: 0.5 },
    })
  } else {
    for (const img of input.images) {
      parts.push({ inlineData: { data: Buffer.from(img.data).toString("base64"), mimeType: img.mimeType } })
    }
  }
  parts.push({ text: analysisPrompt(ctx) })

  let text: string | undefined
  try {
    const res = await gemini().models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: analysisJsonSchema(vocab, ctx.isVideo),
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })
    const blocked = res.promptFeedback?.blockReason
    if (blocked) throw new FatalAnalysisError(`Blocked by the model (${blocked}).`)
    text = res.text
  } catch (error) {
    throw classifyError(error)
  }

  if (!text) throw new RetryableAnalysisError("Empty response from the model.")
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new RetryableAnalysisError("The model returned invalid JSON.")
  }
  const parsed = analysisOutputSchema.safeParse(json)
  if (!parsed.success) throw new RetryableAnalysisError("The model returned an unexpected structure.")
  return { output: parsed.data, model }
}

function classifyError(error: unknown): Error {
  if (error instanceof FatalAnalysisError || error instanceof RetryableAnalysisError) return error
  if (error instanceof ApiError) {
    const retryAfterMs = parseRetryDelay(error.message)
    if (error.status === 429) {
      return new RetryableAnalysisError("Gemini rate limit reached.", retryAfterMs ?? 60_000, "rate_limit")
    }
    if (error.status === 402) {
      return new RetryableAnalysisError(
        "Gemini billing: prepaid credits depleted. Add credits or use a free-tier API key.",
        60 * 60_000,
        "billing",
      )
    }
    if (error.status >= 500 || error.status === 408) {
      return new RetryableAnalysisError(`Gemini temporarily unavailable (${error.status}).`, retryAfterMs)
    }
    if (error.status === 401 || error.status === 403) {
      return new RetryableAnalysisError("Gemini API key rejected. Check GEMINI_API_KEY.", 30 * 60_000, "auth")
    }
    return new FatalAnalysisError(`Gemini rejected the request (${error.status}): ${shorten(error.message)}`)
  }
  return new RetryableAnalysisError(error instanceof Error ? shorten(error.message) : "Unknown error.")
}

function parseRetryDelay(message: string): number | undefined {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message)
  return m?.[1] ? Math.ceil(Number(m[1]) * 1000) : undefined
}

function shorten(message: string): string {
  return message.replace(/\s+/g, " ").slice(0, 300)
}
