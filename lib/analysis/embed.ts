import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { embedDocuments, embeddingModel, toPgVector } from "@/lib/ai/embeddings"
import { RetryableAnalysisError } from "@/lib/ai/errors"
import { getObjectBytes } from "@/lib/r2/presign"
import type { Database } from "@/types/database"

import type { RunResult } from "./process"

type Db = SupabaseClient<Database>
type Row = Database["public"]["Functions"]["next_embedding_batch"]["Returns"][number]

const BATCH_SIZE = 8

/**
 * Embeds the next batch of approved references that have no vector (or one from
 * another model). Runs when the analysis queue is idle. RLS scopes it to the caller.
 */
export async function embedNext(db: Db): Promise<RunResult> {
  const model = embeddingModel()
  if (!model) return { state: "idle" }

  const { data, error } = await db.rpc("next_embedding_batch", { p_model: model, p_limit: BATCH_SIZE })
  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return { state: "idle" }

  // A missing preview only drops the image; the text still gets a vector.
  const images = await Promise.all(
    rows.map((r) => (r.thumbnail_key ? getObjectBytes(r.thumbnail_key).catch(() => undefined) : undefined)),
  )

  let vectors: number[][]
  try {
    vectors = await embedDocuments(rows.map((r, i) => ({ image: images[i], text: embeddingText(r) })))
  } catch (error) {
    if (error instanceof RetryableAnalysisError && error.pauseQueue) {
      return { state: "paused", reason: error.pauseQueue, retryAfterMs: error.retryAfterMs ?? 60_000, error: error.message }
    }
    // Push the batch to the back of the line so one bad item cannot block the rest.
    const now = new Date().toISOString()
    await db.from("references").update({ embedding_attempted_at: now }).in("id", rows.map((r) => r.id))
    console.error("[embeddings] batch failed:", error instanceof Error ? error.message : error)
    return { state: "embedded", count: 0 }
  }

  const now = new Date().toISOString()
  const results = await Promise.all(
    rows.map((r, i) =>
      db
        .from("references")
        .update({ embedding: toPgVector(vectors[i]!), embedding_model: model, embedded_at: now, embedding_attempted_at: null })
        .eq("id", r.id),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
  return { state: "embedded", count: rows.length }
}

/** Curated, English text that describes the reference for retrieval. Pure. */
export function embeddingText(r: Row): string {
  const line = (label: string, value: string | null | undefined) => (value?.trim() ? `${label}: ${value.trim()}` : null)
  const list = (label: string, values: string[] | null | undefined) =>
    values && values.length > 0 ? `${label}: ${values.join(", ")}` : null

  return [
    line("Title", r.title),
    line("Description", r.description),
    line("Subject", r.subject),
    line("Setting", r.setting),
    line("Era", r.era),
    line("Visual style", r.visual_style),
    line("Texture", r.texture_grain),
    line("Shot", r.shot_type),
    line("Angle", r.camera_angle),
    line("Camera movement", r.camera_movement),
    list("Lighting", r.lighting),
    list("Mood", r.mood),
    list("Tags", r.tags),
    line("Notes", r.notes),
  ]
    .filter(Boolean)
    .join("\n")
}
