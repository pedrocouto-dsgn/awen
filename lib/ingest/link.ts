import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveLink, type ResolvedLink } from "@/lib/links/resolve"
import { safeFetch } from "@/lib/links/safe-fetch"
import { aspectRatio, LIMITS, MB } from "@/lib/media/limits"
import { processImage } from "@/lib/media/server-image"
import { keys } from "@/lib/r2/keys"
import { putObject } from "@/lib/r2/presign"
import type { Database, TablesInsert } from "@/types/database"

/**
 * Creates a reference from a URL: YouTube/Vimeo via oEmbed, other pages via Open Graph.
 * The preview image is downloaded server-side and stored in R2. Without capturable
 * media, the reference is stored as link-only so a file can be uploaded manually.
 * owner_id is set explicitly, so this works with a session client or the secret-key client.
 */
export async function ingestLink(
  db: SupabaseClient<Database>,
  userId: string,
  url: string,
): Promise<{ referenceId: string; link: ResolvedLink; row: TablesInsert<"references"> }> {
  const link = await resolveLink(url)
  const referenceId = crypto.randomUUID()

  const row: TablesInsert<"references"> = {
    id: referenceId,
    owner_id: userId,
    type: link.type,
    source_kind: link.sourceKind,
    source_url: link.url,
    source_meta: link.meta,
    title: link.title?.slice(0, 300) ?? null,
    width: link.width,
    height: link.height,
    aspect_ratio: aspectRatio(link.width, link.height),
    duration: link.duration,
    status: "pending",
    media_ready: false,
  }

  if (link.imageUrl) {
    try {
      const res = await safeFetch(link.imageUrl, {
        accept: "image/*",
        maxBytes: link.imageIsMedia ? LIMITS.imageBytes : 15 * MB,
        timeoutMs: 15000,
      })
      if (res.status === 200) {
        const image = await processImage(res.body)
        const thumbKey = keys.thumb(userId, referenceId)
        await putObject(thumbKey, image.thumbnail, "image/jpeg")
        row.thumbnail_key = thumbKey
        row.palette = image.palette
        row.phash = image.phash
        row.media_ready = true

        if (link.imageIsMedia) {
          const originalKey = keys.original(userId, referenceId, image.mime)
          await putObject(originalKey, res.body, image.mime)
          row.storage_key = originalKey
          row.mime_type = image.mime
          row.file_size = res.body.byteLength
          row.width = image.width
          row.height = image.height
          row.aspect_ratio = aspectRatio(image.width, image.height)
        } else if (!row.width || !row.height) {
          row.width = image.width
          row.height = image.height
          row.aspect_ratio = aspectRatio(image.width, image.height)
        }
      }
    } catch (error) {
      // Preview could not be captured: keep it as a link-only reference.
      console.warn("[ingest:link] preview failed:", error instanceof Error ? error.message : error)
    }
  }

  const { error } = await db.from("references").insert(row)
  if (error) throw error
  return { referenceId, link, row }
}
