import "server-only"

import { embeddingModel, embedImageQuery, embedQuery, toPgVector } from "@/lib/ai/embeddings"
import { RetryableAnalysisError } from "@/lib/ai/errors"
import type { ServerSupabase } from "@/lib/supabase/server"

/**
 * Cut-offs in cosine distance, measured on gemini-embedding-2 (768-d). Text
 * queries land far from image+text documents (relevant ≈ 0.53–0.63, unrelated
 * ≈ 0.64–0.73), image queries much closer (alike ≈ 0.13–0.26, unrelated ≥ 0.33).
 */
export const TEXT_SEARCH = { maxDistance: 0.65, margin: 0.05 }
export const VISUAL_SEARCH = { maxDistance: 0.32, margin: 0.15 }

/** Shorter queries ("a", "of") are left to full-text search. */
const MIN_SEMANTIC_LENGTH = 3

/** Image queries older than this are deleted; a library URL pointing at one finds nothing. */
const IMAGE_QUERY_TTL_DAYS = 30

export function textKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200)
}

/** Whether a text query is long enough to be searched by meaning. */
export function isSemanticQuery(query: string): boolean {
  return textKey(query).length >= MIN_SEMANTIC_LENGTH
}

/**
 * search_queries id holding the vector for a text query. Embedded once per
 * owner, model and text, then reused (pagination, back button, repeated searches).
 * Null when the query is too short or embeddings are unavailable (no key, quota).
 */
export async function textQueryVector(supabase: ServerSupabase, query: string): Promise<string | null> {
  const model = embeddingModel()
  const key = textKey(query)
  if (!model || !isSemanticQuery(key)) return null

  const cached = await findTextQuery(supabase, model, key)
  if (cached) return cached

  let vector: number[]
  try {
    vector = await embedQuery(key)
  } catch (error) {
    console.warn("[search] query embedding failed:", error instanceof Error ? error.message : error)
    return null
  }

  const { data, error } = await supabase
    .from("search_queries")
    .insert({ kind: "text", text_key: key, model, embedding: toPgVector(vector) })
    .select("id")
    .single()
  if (data) return data.id
  // Two requests embedding the same query at once: the other one won.
  if (error?.code === "23505") return findTextQuery(supabase, model, key)
  console.warn("[search] could not cache query vector:", error?.message)
  return null
}

async function findTextQuery(supabase: ServerSupabase, model: string, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("search_queries")
    .select("id")
    .eq("kind", "text")
    .eq("model", model)
    .eq("text_key", key)
    .maybeSingle()
  return data?.id ?? null
}

/** Embeds an image dropped on the search box and stores it. Throws when embeddings are unavailable. */
export async function createImageQuery(
  supabase: ServerSupabase,
  image: Uint8Array,
  preview: string,
): Promise<string> {
  const model = embeddingModel()
  if (!model) throw new RetryableAnalysisError("Embeddings are not configured (no Gemini key).", undefined, "auth")
  const vector = await embedImageQuery(image)

  const { data, error } = await supabase
    .from("search_queries")
    .insert({ kind: "image", model, embedding: toPgVector(vector), preview })
    .select("id")
    .single()
  if (error) throw error

  // Housekeeping: old image searches are not worth keeping.
  const cutoff = new Date(Date.now() - IMAGE_QUERY_TTL_DAYS * 86_400_000).toISOString()
  await supabase.from("search_queries").delete().eq("kind", "image").lt("created_at", cutoff)
  return data.id
}
