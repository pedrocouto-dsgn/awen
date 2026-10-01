import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { aspectRatio } from "@/lib/media/limits"
import { processImage } from "@/lib/media/server-image"
import { keys, ownsKey } from "@/lib/r2/keys"
import { deletePrefix, getObjectBytes, headObject, presignPut, putObject } from "@/lib/r2/presign"
import type { Database } from "@/types/database"

// Extension requests run with the secret-key client (no user session), so every
// query here is scoped to the token owner explicitly.

type Db = SupabaseClient<Database>

export type ActiveProject = { id: string; name: string }

export async function getActiveProject(db: Db, userId: string): Promise<ActiveProject | null> {
  const { data, error } = await db
    .from("projects")
    .select("id, name")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Adds the reference to the active project, if there is one. Returns the project or null. */
export async function addToActiveProject(db: Db, userId: string, referenceId: string): Promise<ActiveProject | null> {
  const project = await getActiveProject(db, userId)
  if (!project) return null
  const { error } = await db
    .from("project_references")
    .insert({ owner_id: userId, project_id: project.id, reference_id: referenceId })
  if (error && error.code !== "23505") throw error
  return project
}

export type ImageSource = { mimeType: string; size: number; srcUrl?: string; pageUrl?: string; pageTitle?: string }

/**
 * Creates a pending image reference and a presigned PUT for the original. The
 * extension uploads the bytes it fetched (with the user's cookies), then calls finalizeImage.
 */
export async function createImage(db: Db, userId: string, source: ImageSource) {
  const referenceId = crypto.randomUUID()
  const originalKey = keys.original(userId, referenceId, source.mimeType)
  const sourceUrl = source.pageUrl ?? source.srcUrl ?? null

  const { error } = await db.from("references").insert({
    id: referenceId,
    owner_id: userId,
    type: "image",
    source_kind: sourceUrl ? "link" : "upload",
    source_url: sourceUrl,
    source_meta: source.srcUrl && source.srcUrl !== sourceUrl ? { imageUrl: source.srcUrl, savedWith: "extension" } : { savedWith: "extension" },
    title: source.pageTitle?.trim().slice(0, 300) || null,
    storage_key: originalKey,
    mime_type: source.mimeType,
    file_size: source.size,
    status: "pending",
    media_ready: false,
  })
  if (error) throw error

  const url = await presignPut(originalKey, source.mimeType, source.size)
  return { referenceId, upload: { url, contentType: source.mimeType } }
}

export type FinalizeResult = { ok: true } | { ok: false; status: 404 | 409 | 422; error: string }

/** Checks the upload landed, then derives thumbnail, palette and fingerprint server-side and queues the analysis. */
export async function finalizeImage(db: Db, userId: string, referenceId: string): Promise<FinalizeResult> {
  const { data: ref, error } = await db
    .from("references")
    .select("id, storage_key, file_size, media_ready")
    .eq("id", referenceId)
    .eq("owner_id", userId)
    .maybeSingle()
  if (error) throw error
  if (!ref || !ref.storage_key || !ownsKey(userId, ref.storage_key)) {
    return { ok: false, status: 404, error: "Referência não encontrada." }
  }
  if (ref.media_ready) return { ok: true }

  const head = await headObject(ref.storage_key)
  if (!head) return { ok: false, status: 409, error: "O envio ainda não terminou." }
  if (ref.file_size && head.size !== ref.file_size) {
    return { ok: false, status: 409, error: "O arquivo enviado não confere com o esperado." }
  }

  const bytes = await getObjectBytes(ref.storage_key)
  let image: Awaited<ReturnType<typeof processImage>>
  try {
    image = await processImage(bytes)
  } catch {
    // Not a readable image (e.g. an HTML error page): drop the half-created reference.
    await db.from("references").delete().eq("id", referenceId).eq("owner_id", userId)
    await deletePrefix(keys.prefix(userId, referenceId))
    return { ok: false, status: 422, error: "Este arquivo não é uma imagem suportada." }
  }
  const thumbKey = keys.thumb(userId, referenceId)
  await putObject(thumbKey, image.thumbnail, "image/jpeg")

  const { error: updateError } = await db
    .from("references")
    .update({
      thumbnail_key: thumbKey,
      mime_type: image.mime,
      width: image.width,
      height: image.height,
      aspect_ratio: aspectRatio(image.width, image.height),
      palette: image.palette,
      phash: image.phash,
      media_ready: true,
      status: "pending",
      analyzed_at: null,
    })
    .eq("id", referenceId)
    .eq("owner_id", userId)
  if (updateError) throw updateError
  return { ok: true }
}
