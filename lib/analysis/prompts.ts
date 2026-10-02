import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { generateJson } from "@/lib/ai/analyze"
import { embedDocuments, embeddingModel, toPgVector } from "@/lib/ai/embeddings"
import { FatalAnalysisError, RetryableAnalysisError } from "@/lib/ai/errors"
import {
  cleanSections,
  promptAnalysisJsonSchema,
  promptAnalysisOutputSchema,
  promptAnalysisPrompt,
  SECTION_KEYS,
  SECTION_LABEL,
} from "@/lib/ai/prompt-analysis"
import { getObjectBytes } from "@/lib/r2/presign"
import type { Database, Json, Prompt } from "@/types/database"

import type { RunResult } from "./process"

type Db = SupabaseClient<Database>

/** Longer prompts are cut for the model (sections only need the structure). */
const MAX_PROMPT_CHARS = 30_000
const EMBED_BATCH = 8

/** Analyzes the next prompt that needs it: suggested tags and sections. RLS scopes it to the caller. */
export async function analyzeNextPrompt(db: Db): Promise<RunResult> {
  const { data, error } = await db.rpc("next_prompt_analysis", { p_limit: 1 })
  if (error) throw error
  const prompt = data?.[0]
  if (!prompt) return { state: "idle" }

  try {
    const image = await firstResultImage(db, prompt.id)
    const text = prompt.prompt_text.slice(0, MAX_PROMPT_CHARS)
    const { output, model } = await generateJson(
      { kind: "images", images: image ? [{ data: image, mimeType: "image/jpeg" }] : [] },
      promptAnalysisPrompt({ hasResult: Boolean(image), tool: prompt.tool, model: prompt.model, text }),
      promptAnalysisJsonSchema,
      promptAnalysisOutputSchema,
    )
    const sections = cleanSections(output.sections, prompt.prompt_text)
    const tags = [...new Set(output.suggested_tags.map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")))]
      .filter((t) => t.length > 0 && t.length <= 40)
      .slice(0, 12)
    const now = new Date().toISOString()
    const { error: updateError } = await db
      .from("prompts")
      .update({
        sections: sections as Json,
        ai: { model, analyzed_at: now, suggested_tags: tags, raw_sections: output.sections } as Json,
        analyzed_at: now,
        analysis_attempted_at: null,
        analysis_error: null,
      })
      .eq("id", prompt.id)
    if (updateError) throw updateError
    return { state: "prompt_analyzed", id: prompt.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error."
    if (error instanceof RetryableAnalysisError && error.pauseQueue) {
      return { state: "paused", reason: error.pauseQueue, retryAfterMs: error.retryAfterMs ?? 60_000, error: message }
    }
    // Waits 6 hours before the next try (next_prompt_analysis), so one bad prompt cannot block the rest.
    await db
      .from("prompts")
      .update({ analysis_attempted_at: new Date().toISOString(), analysis_error: message })
      .eq("id", prompt.id)
    if (!(error instanceof RetryableAnalysisError) && !(error instanceof FatalAnalysisError)) {
      console.error("[prompt-analysis] unexpected error:", message)
    }
    return { state: "failed", id: prompt.id, error: message }
  }
}

/** Embeds the next batch of prompts without a vector (text + first result image). */
export async function embedNextPrompts(db: Db): Promise<RunResult> {
  const model = embeddingModel()
  if (!model) return { state: "idle" }

  const { data, error } = await db.rpc("next_prompt_embedding", { p_model: model, p_limit: EMBED_BATCH })
  if (error) throw error
  const prompts = data ?? []
  if (prompts.length === 0) return { state: "idle" }

  const images = await Promise.all(prompts.map((p) => firstResultImage(db, p.id).catch(() => undefined)))
  let vectors: number[][]
  try {
    vectors = await embedDocuments(prompts.map((p, i) => ({ image: images[i], text: promptEmbeddingText(p) })))
  } catch (error) {
    if (error instanceof RetryableAnalysisError && error.pauseQueue) {
      return { state: "paused", reason: error.pauseQueue, retryAfterMs: error.retryAfterMs ?? 60_000, error: error.message }
    }
    await db
      .from("prompts")
      .update({ embedding_attempted_at: new Date().toISOString() })
      .in("id", prompts.map((p) => p.id))
    console.error("[prompt-embeddings] batch failed:", error instanceof Error ? error.message : error)
    return { state: "embedded", count: 0 }
  }

  const now = new Date().toISOString()
  const results = await Promise.all(
    prompts.map((p, i) =>
      db
        .from("prompts")
        .update({ embedding: toPgVector(vectors[i]!), embedding_model: model, embedded_at: now, embedding_attempted_at: null })
        .eq("id", p.id),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
  return { state: "embedded", count: prompts.length }
}

/** Preview of the first result: an uploaded file's thumbnail, or the linked reference's. */
async function firstResultImage(db: Db, promptId: string): Promise<Uint8Array | undefined> {
  const { data } = await db
    .from("prompt_assets")
    .select("thumbnail_key, reference_id")
    .eq("prompt_id", promptId)
    .eq("role", "result")
    .eq("media_ready", true)
    .order("sort_order")
    .order("created_at")
    .limit(1)
    .maybeSingle()
  let key = data?.thumbnail_key ?? null
  if (!key && data?.reference_id) {
    const { data: ref } = await db.from("references").select("thumbnail_key").eq("id", data.reference_id).maybeSingle()
    key = ref?.thumbnail_key ?? null
  }
  if (!key) return undefined
  try {
    return await getObjectBytes(key)
  } catch {
    return undefined
  }
}

/** What the vector describes: title, the text, its sections and the curated fields. Pure. */
export function promptEmbeddingText(p: Pick<Prompt, "title" | "prompt_text" | "tags" | "notes" | "tool" | "model"> & { sections: unknown }): string {
  const sections = (p.sections ?? {}) as Partial<Record<(typeof SECTION_KEYS)[number], string>>
  return [
    p.title ? `Title: ${p.title}` : null,
    p.model || p.tool ? `Made with: ${[p.model, p.tool].filter(Boolean).join(", ")}` : null,
    `Prompt: ${p.prompt_text.slice(0, 6000)}`,
    ...SECTION_KEYS.map((k) => (sections[k] ? `${SECTION_LABEL[k]}: ${sections[k]}` : null)),
    p.tags.length ? `Tags: ${p.tags.join(", ")}` : null,
    p.notes ? `Notes: ${p.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}
