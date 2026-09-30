import { NextResponse } from "next/server"

import { invalid, jsonError, notFound, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { aspectRatio } from "@/lib/media/limits"
import { keys } from "@/lib/r2/keys"
import { presignPut } from "@/lib/r2/presign"
import { createClient, getUserId } from "@/lib/supabase/server"
import { createUploadSchema, type CreateUploadResponse } from "@/lib/validation/ingest"
import type { TablesUpdate } from "@/types/database"

import { findDuplicates } from "./duplicates"

/**
 * Creates a reference for a browser upload (or attaches a file to a link-only
 * reference) and returns presigned PUT URLs. The browser uploads straight to R2,
 * then calls /api/references/:id/finalize.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  const parsed = createUploadSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  const { attachTo, file, tech, thumb, frames } = parsed.data

  try {
    const referenceId = attachTo ?? crypto.randomUUID()
    const originalKey = keys.original(userId, referenceId, file.mimeType)
    const thumbKey = keys.thumb(userId, referenceId)
    const frameKeys = frames.map((_, i) => keys.frame(userId, referenceId, i + 1))

    const fields = {
      type: file.type,
      storage_key: originalKey,
      thumbnail_key: thumbKey,
      frame_keys: frameKeys,
      media_ready: false,
      width: tech.width,
      height: tech.height,
      aspect_ratio: aspectRatio(tech.width, tech.height),
      file_size: file.size,
      mime_type: file.mimeType,
      duration: file.type === "video" ? (tech.duration ?? null) : null,
      fps: file.type === "video" ? (tech.fps ?? null) : null,
      palette: tech.palette,
      phash: tech.phash,
      status: "pending",
      analyzed_at: null,
      analysis_attempts: 0,
      analysis_error: null,
      next_attempt_at: null,
    } satisfies TablesUpdate<"references">

    if (attachTo) {
      const { data: existing, error } = await supabase
        .from("references")
        .select("id, media_ready")
        .eq("id", attachTo)
        .maybeSingle()
      if (error) throw error
      if (!existing) return notFound()
      if (existing.media_ready) return jsonError(409, "Esta referência já tem mídia.")
      const { error: updateError } = await supabase.from("references").update(fields).eq("id", attachTo)
      if (updateError) throw updateError
    } else {
      const title = file.name.replace(/\.[^.]+$/, "").slice(0, 200) || null
      const { error } = await supabase
        .from("references")
        .insert({ id: referenceId, source_kind: "upload", title, ...fields })
      if (error) throw error
    }

    const [originalUrl, thumbUrl, ...frameUrls] = await Promise.all([
      presignPut(originalKey, file.mimeType, file.size),
      presignPut(thumbKey, "image/jpeg", thumb.size),
      ...frames.map((f, i) => presignPut(frameKeys[i]!, "image/jpeg", f.size)),
    ])

    const duplicates = tech.phash ? await findDuplicates(supabase, tech.phash, referenceId) : []

    return NextResponse.json<CreateUploadResponse>({
      referenceId,
      original: { key: originalKey, url: originalUrl!, contentType: file.mimeType },
      thumb: { key: thumbKey, url: thumbUrl!, contentType: "image/jpeg" },
      frames: frameKeys.map((key, i) => ({ key, url: frameUrls[i]!, contentType: "image/jpeg" })),
      duplicates,
    })
  } catch (error) {
    return serverError("references:create", error)
  }
}
