import "server-only"

import { aiConfig, aiFallbackConfig, type AiConfig } from "@/lib/env/server"

import { RetryableAnalysisError } from "./errors"
import { analysisPrompt, type AnalysisContext } from "./prompt"
import { geminiProvider } from "./providers/gemini"
import { openRouterProvider } from "./providers/openrouter"
import { analysisJsonSchema, analysisOutputSchema, type AnalysisOutput, type Vocabularies } from "./schema"
import type { AnalysisInput, AnalysisProvider } from "./types"

export { FatalAnalysisError, RetryableAnalysisError } from "./errors"
export type { AnalysisInput } from "./types"

const PROVIDERS: Record<AiConfig["provider"], AnalysisProvider> = {
  gemini: geminiProvider,
  openrouter: openRouterProvider,
}

/**
 * Analyzes media with the provider set in AI_PROVIDER. When its daily quota is used up
 * and AI_FALLBACK_* is configured, the fallback provider analyzes the item instead.
 * Output is validated against the same schema for every provider.
 */
export async function analyzeMedia(
  input: AnalysisInput,
  ctx: AnalysisContext,
  vocab: Vocabularies,
): Promise<{ output: AnalysisOutput; model: string }> {
  let config: AiConfig
  try {
    config = aiConfig()
  } catch (error) {
    // Missing key or model: every item would fail the same way, so pause the queue.
    throw new RetryableAnalysisError(error instanceof Error ? error.message : "AI is not configured.", 30 * 60_000, "auth")
  }

  try {
    return await analyzeWith(config, input, ctx, vocab)
  } catch (error) {
    const fallback = aiFallbackConfig()
    if (!(error instanceof RetryableAnalysisError && error.dailyQuota) || !fallback) throw error
    // The main provider is checked again on every item, so it takes back over once its quota resets.
    return analyzeWith(fallback, input, ctx, vocab)
  }
}

async function analyzeWith(
  config: AiConfig,
  input: AnalysisInput,
  ctx: AnalysisContext,
  vocab: Vocabularies,
): Promise<{ output: AnalysisOutput; model: string }> {
  const text = await PROVIDERS[config.provider].generate(
    { input, ctx, vocab, prompt: analysisPrompt(ctx), jsonSchema: analysisJsonSchema(vocab, ctx.isVideo) },
    config,
  )

  if (!text) throw new RetryableAnalysisError("Empty response from the model.")
  let json: unknown
  try {
    json = JSON.parse(stripCodeFence(text))
  } catch {
    throw new RetryableAnalysisError("The model returned invalid JSON.")
  }
  const parsed = analysisOutputSchema.safeParse(json)
  if (!parsed.success) throw new RetryableAnalysisError("The model returned an unexpected structure.")
  return { output: parsed.data, model: config.model }
}

/** Some models wrap JSON in a ```json fence even when asked for raw JSON. */
function stripCodeFence(text: string): string {
  const m = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text)
  return m?.[1] ?? text
}
