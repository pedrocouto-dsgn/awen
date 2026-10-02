import "server-only"

import { errorForStatus, FatalAnalysisError, RetryableAnalysisError, shorten } from "../errors"
import type { AnalysisProvider } from "../types"

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
const TIMEOUT_MS = 50_000

type ChatResponse = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[]
  error?: { code?: number; message?: string }
}

/**
 * OpenAI-compatible chat completions via OpenRouter (e.g. Qwen-VL). Images go as
 * data URLs. YouTube URLs are not readable here, so they raise FatalAnalysisError
 * and the queue falls back to the thumbnail.
 */
export const openRouterProvider: AnalysisProvider = {
  label: "OpenRouter",
  async generate({ input, prompt, jsonSchema }, { model, apiKey }) {
    if (input.kind === "youtube") throw new FatalAnalysisError("This provider cannot read YouTube videos.")

    const content = [
      ...input.images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: `data:${img.mimeType};base64,${Buffer.from(img.data).toString("base64")}` },
      })),
      { type: "text" as const, text: prompt },
    ]

    let res: Response
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "Awen",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content }],
          temperature: 0.3,
          response_format: {
            type: "json_schema",
            // Not strict: models differ in which JSON Schema keywords they accept. Zod validates the result.
            json_schema: { name: "analysis", strict: false, schema: stripGeminiKeywords(jsonSchema) },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      throw new RetryableAnalysisError(error instanceof Error ? shorten(error.message) : "Network error.")
    }

    const body = (await res.json().catch(() => ({}))) as ChatResponse
    const status = res.ok ? body.error?.code : res.status
    if (status) {
      const retryAfter = Number(res.headers.get("retry-after"))
      throw errorForStatus("OpenRouter", status, body.error?.message ?? res.statusText, retryAfter > 0 ? retryAfter * 1000 : undefined)
    }
    return body.choices?.[0]?.message?.content ?? undefined
  },
}

/** Removes Gemini-only keywords (propertyOrdering) that other providers may reject. */
function stripGeminiKeywords(schema: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...schema }
  delete rest.propertyOrdering
  return rest
}
