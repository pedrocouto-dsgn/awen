import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { analyzeMedia, FatalAnalysisError, RetryableAnalysisError, type AnalysisInput } from "@/lib/gemini/analyze"
import type { AnalysisContext } from "@/lib/gemini/prompt"
import { OTHER, type AnalysisOutput, type Vocabularies } from "@/lib/gemini/schema"
import { getObjectBytes } from "@/lib/r2/presign"
import type { Database, Reference, TablesUpdate, VocabCategory } from "@/types/database"

export const MAX_ATTEMPTS = 5
const BASE_BACKOFF_MS = 30_000
const MAX_BACKOFF_MS = 30 * 60_000

export type PauseReason = "rate_limit" | "billing" | "auth" | "daily_limit"

export type RunResult =
  | { state: "idle" }
  | { state: "done"; id: string }
  | { state: "rescheduled"; id: string; retryAt: string; error: string }
  | { state: "failed"; id: string; error: string }
  | { state: "paused"; id?: string; reason: PauseReason; retryAfterMs: number; error: string }

type Db = SupabaseClient<Database>

/** Claims the next due item (RLS scopes it to the caller) and analyzes it. */
export async function processNext(db: Db): Promise<RunResult> {
  const { data, error } = await db.rpc("claim_next_analysis")
  if (error) throw error
  const ref = data?.[0]
  if (!ref) return { state: "idle" }
  return processClaimed(db, ref)
}

async function processClaimed(db: Db, ref: Reference): Promise<RunResult> {
  if (ref.analysis_attempts > MAX_ATTEMPTS) {
    const message = "Analysis kept timing out."
    await markFailed(db, ref.id, message)
    return { state: "failed", id: ref.id, error: message }
  }

  try {
    const vocab = await loadVocabularies(db, ref.owner_id)
    const { output, model, inputKind } = await runAnalysis(ref, vocab)
    await saveResult(db, ref.id, output, vocab, { model, inputKind })
    return { state: "done", id: ref.id }
  } catch (error) {
    return handleFailure(db, ref, error)
  }
}

async function runAnalysis(ref: Reference, vocab: Vocabularies) {
  const isVideo = ref.type === "video"
  const base: Omit<AnalysisContext, "inputKind"> = {
    isVideo,
    title: ref.source_kind === "upload" ? null : ref.title,
    sourceUrl: ref.source_kind === "upload" ? null : ref.source_url,
    duration: ref.duration,
    fps: ref.fps,
    width: ref.width,
    height: ref.height,
  }

  if (ref.source_kind === "youtube" && ref.source_url) {
    try {
      const res = await analyzeMedia({ kind: "youtube", url: ref.source_url }, { ...base, inputKind: "youtube" }, vocab)
      return { ...res, inputKind: "youtube" as const }
    } catch (error) {
      // Private, age-restricted or unsupported videos: fall back to the thumbnail.
      if (!(error instanceof FatalAnalysisError)) throw error
    }
  }

  const keys = isVideo && ref.frame_keys.length > 0 ? [ref.thumbnail_key, ...ref.frame_keys] : [ref.thumbnail_key]
  const present = keys.filter((k): k is string => Boolean(k))
  if (present.length === 0) throw new FatalAnalysisError("No media to analyze.")

  let images: { data: Uint8Array; mimeType: string }[]
  try {
    images = await Promise.all(present.map(async (k) => ({ data: await getObjectBytes(k), mimeType: "image/jpeg" })))
  } catch {
    throw new RetryableAnalysisError("Could not read the media from storage.")
  }

  const inputKind: AnalysisContext["inputKind"] =
    ref.source_kind === "upload" ? (isVideo ? "frames" : "image") : ref.source_kind === "link" && !isVideo ? "image" : "thumbnail"
  const input: AnalysisInput = { kind: "images", images }
  const res = await analyzeMedia(input, { ...base, inputKind }, vocab)
  return { ...res, inputKind }
}

export async function loadVocabularies(db: Db, ownerId: string): Promise<Vocabularies> {
  const { data, error } = await db
    .from("vocabularies")
    .select("category, term")
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .order("sort_order")
  if (error) throw error
  const vocab: Vocabularies = { shot_type: [], camera_angle: [], camera_movement: [], lighting: [], mood: [] }
  for (const row of data ?? []) vocab[row.category].push(row.term)
  return vocab
}

function pickOne(value: string | undefined, terms: string[]): string | null {
  if (!value || value === OTHER) return null
  return terms.find((t) => t.toLowerCase() === value.toLowerCase()) ?? null
}

function pickMany(values: string[], terms: string[]): string[] {
  const picked = values.map((v) => pickOne(v, terms)).filter((v): v is string => Boolean(v))
  return [...new Set(picked)]
}

function cleanTags(tags: string[]): string[] {
  const out = tags.map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")).filter((t) => t.length > 0 && t.length <= 40)
  return [...new Set(out)].slice(0, 12)
}

/** New-term suggestions per category, surfaced in the review screen. */
export function suggestedTerms(output: AnalysisOutput): Partial<Record<VocabCategory, string[]>> {
  const one = (s?: { value: string; suggested_new_term?: string | null }) =>
    s?.value === OTHER && s.suggested_new_term ? [s.suggested_new_term.trim().toLowerCase()] : []
  return {
    shot_type: one(output.shot_type),
    camera_angle: one(output.camera_angle),
    camera_movement: one(output.camera_movement),
    lighting: output.lighting.suggested_new_terms.map((t) => t.trim().toLowerCase()).filter(Boolean),
    mood: output.mood.suggested_new_terms.map((t) => t.trim().toLowerCase()).filter(Boolean),
  }
}

/** Maps model output to curated columns: vocabulary terms must match the user's list. Pure. */
export function mapAnalysis(output: AnalysisOutput, vocab: Vocabularies) {
  return {
    shot_type: pickOne(output.shot_type.value, vocab.shot_type),
    camera_angle: pickOne(output.camera_angle.value, vocab.camera_angle),
    camera_movement: pickOne(output.camera_movement?.value, vocab.camera_movement),
    lighting: pickMany(output.lighting.values, vocab.lighting),
    mood: pickMany(output.mood.values, vocab.mood),
    visual_style: output.visual_style.trim() || null,
    texture_grain: output.texture_grain.trim() || null,
    setting: output.setting.trim() || null,
    era: output.era.trim() || null,
    subject: output.subject.trim() || null,
    description: output.description.trim() || null,
    tags: cleanTags(output.suggested_tags),
  } satisfies TablesUpdate<"references">
}

async function saveResult(
  db: Db,
  id: string,
  output: AnalysisOutput,
  vocab: Vocabularies,
  meta: { model: string; inputKind: string },
) {
  const now = new Date().toISOString()
  const update: TablesUpdate<"references"> = {
    status: "pending",
    analyzed_at: now,
    analyzing_since: null,
    next_attempt_at: null,
    analysis_error: null,
    ai: {
      model: meta.model,
      input: meta.inputKind,
      analyzed_at: now,
      suggested_terms: suggestedTerms(output),
      output,
    },
    ...mapAnalysis(output, vocab),
  }
  const { error } = await db.from("references").update(update).eq("id", id)
  if (error) throw error
}

async function markFailed(db: Db, id: string, message: string) {
  await db
    .from("references")
    .update({ status: "failed", analysis_error: message, analyzing_since: null, next_attempt_at: null })
    .eq("id", id)
}

async function handleFailure(db: Db, ref: Reference, error: unknown): Promise<RunResult> {
  const message = error instanceof Error ? error.message : "Unknown error."

  if (error instanceof RetryableAnalysisError && error.pauseQueue) {
    // Queue-wide problem: give the attempt back and let the worker pause.
    // The item itself is not delayed, so it is picked up as soon as the problem is fixed.
    const retryAfterMs = error.retryAfterMs ?? 60_000
    await db
      .from("references")
      .update({
        status: "pending",
        analysis_attempts: Math.max(0, ref.analysis_attempts - 1),
        analyzing_since: null,
        next_attempt_at: null,
        analysis_error: message,
      })
      .eq("id", ref.id)
    return { state: "paused", id: ref.id, reason: error.pauseQueue, retryAfterMs, error: message }
  }

  if (error instanceof RetryableAnalysisError && ref.analysis_attempts < MAX_ATTEMPTS) {
    const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (ref.analysis_attempts - 1))
    const retryAt = new Date(Date.now() + Math.max(backoff, error.retryAfterMs ?? 0)).toISOString()
    await db
      .from("references")
      .update({ status: "pending", analyzing_since: null, next_attempt_at: retryAt, analysis_error: message })
      .eq("id", ref.id)
    return { state: "rescheduled", id: ref.id, retryAt, error: message }
  }

  if (!(error instanceof RetryableAnalysisError) && !(error instanceof FatalAnalysisError)) {
    console.error("[analysis] unexpected error:", message)
  }
  await markFailed(db, ref.id, message)
  return { state: "failed", id: ref.id, error: message }
}
