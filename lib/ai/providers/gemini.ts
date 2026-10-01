import "server-only"

import { ApiError, GoogleGenAI, ThinkingLevel, type Part } from "@google/genai"

import { errorForStatus, FatalAnalysisError, RetryableAnalysisError, shorten } from "../errors"
import type { AnalysisProvider } from "../types"

const YOUTUBE_CLIP_SECONDS = 90

const clients = new Map<string, GoogleGenAI>()

/** One SDK client per API key (analysis and embeddings may use different keys). */
export function geminiClient(apiKey: string): GoogleGenAI {
  let client = clients.get(apiKey)
  if (!client) {
    client = new GoogleGenAI({ apiKey })
    clients.set(apiKey, client)
  }
  return client
}

export const geminiProvider: AnalysisProvider = {
  label: "Gemini",
  async generate({ input, prompt, jsonSchema }, { model, apiKey }) {
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
    parts.push({ text: prompt })

    try {
      const res = await geminiClient(apiKey).models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          temperature: 0.3,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
      const blocked = res.promptFeedback?.blockReason
      if (blocked) throw new FatalAnalysisError(`Blocked by the model (${blocked}).`)
      return res.text
    } catch (error) {
      throw classifyGeminiError(error)
    }
  },
}

export function classifyGeminiError(error: unknown): Error {
  if (error instanceof FatalAnalysisError || error instanceof RetryableAnalysisError) return error
  if (error instanceof ApiError) {
    // The 429 body names the exhausted quota, e.g. "GenerateRequestsPerDayPerProjectPerModel-FreeTier".
    const daily = /PerDay/i.test(error.message)
    return errorForStatus("Gemini", error.status, error.message, parseRetryDelay(error.message), daily)
  }
  return new RetryableAnalysisError(error instanceof Error ? shorten(error.message) : "Unknown error.")
}

function parseRetryDelay(message: string): number | undefined {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message)
  return m?.[1] ? Math.ceil(Number(m[1]) * 1000) : undefined
}
