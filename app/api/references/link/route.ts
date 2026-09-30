import { NextResponse } from "next/server"

import { invalid, jsonError, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { resolveLink } from "@/lib/links/resolve"
import { safeFetch, UnsafeUrlError } from "@/lib/links/safe-fetch"
import { aspectRatio, LIMITS, MB } from "@/lib/media/limits"
import { processImage } from "@/lib/media/server-image"
import { keys } from "@/lib/r2/keys"
import { putObject } from "@/lib/r2/presign"
import { createClient, getUserId } from "@/lib/supabase/server"
import { linkSchema, type DuplicateMatch, type LinkResponse } from "@/lib/validation/ingest"
import type { TablesInsert } from "@/types/database"

import { findDuplicates } from "../duplicates"

export const maxDuration = 60

/**
 * Adds a reference from a URL: YouTube/Vimeo via oEmbed, other pages via Open Graph.
 * The preview image is downloaded server-side and stored in R2. Without capturable
 * media, the reference is stored as link-only so a file can be uploaded manually.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  const parsed = linkSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)

  try {
    const link = await resolveLink(parsed.data.url)
    const referenceId = crypto.randomUUID()

    const row: TablesInsert<"references"> = {
      id: referenceId,
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
        console.warn("[references:link] preview failed:", error instanceof Error ? error.message : error)
      }
    }

    const { error } = await supabase.from("references").insert(row)
    if (error) throw error

    const duplicates: DuplicateMatch[] = []
    const { data: sameUrl } = await supabase
      .from("references")
      .select("id, status, title")
      .eq("source_url", link.url)
      .neq("id", referenceId)
      .neq("status", "rejected")
      .limit(3)
    for (const d of sameUrl ?? []) duplicates.push({ id: d.id, distance: 0, status: d.status, title: d.title })
    if (row.phash) {
      for (const d of await findDuplicates(supabase, row.phash, referenceId)) {
        if (!duplicates.some((x) => x.id === d.id)) duplicates.push(d)
      }
    }

    return NextResponse.json<LinkResponse>({
      referenceId,
      provider: link.provider,
      title: row.title ?? null,
      hasMedia: Boolean(row.media_ready),
      duplicates,
    })
  } catch (error) {
    if (error instanceof UnsafeUrlError) return jsonError(400, "Este endereço não é permitido.")
    return serverError("references:link", error)
  }
}
