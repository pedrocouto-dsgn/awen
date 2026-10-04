import "server-only"

import { presignGet } from "@/lib/r2/presign"
import { VIEW_TTL_SECONDS } from "@/lib/references/view"
import type { ServerSupabase } from "@/lib/supabase/server"
import { paletteSchema } from "@/lib/validation/ingest"

import { placeNew, type BoardItem } from "./layout"

export type BoardData = {
  items: BoardItem[]
  /** Items placed automatically on this load (new to the board): the editor saves them. */
  placedNow: string[]
}

export type BoardMedia = {
  referenceId: string
  title: string | null
  thumbUrl: string | null
  /** Original file, for images only (videos export their cover). */
  originalUrl: string | null
  mime: string | null
}

async function loadRows(supabase: ServerSupabase, projectId: string) {
  const { data: links, error } = await supabase
    .from("project_references")
    .select("reference_id, x, y, width, height, z_index, caption, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
  if (error) throw error
  if (!links?.length) return []

  const { data: refs, error: refsError } = await supabase
    .from("references")
    .select("id, title, type, width, height, aspect_ratio, thumbnail_key, storage_key, mime_type, palette")
    .in(
      "id",
      links.map((l) => l.reference_id),
    )
  if (refsError) throw refsError
  const byId = new Map((refs ?? []).map((r) => [r.id, r]))
  return links.flatMap((link) => {
    const ref = byId.get(link.reference_id)
    return ref ? [{ link, ref }] : []
  })
}

export async function getBoard(supabase: ServerSupabase, projectId: string): Promise<BoardData> {
  const rows = await loadRows(supabase, projectId)

  const items: BoardItem[] = await Promise.all(
    rows.map(async ({ link, ref }) => {
      const ratio =
        ref.width && ref.height ? ref.width / ref.height : ref.aspect_ratio && ref.aspect_ratio > 0 ? ref.aspect_ratio : 1
      const palette = paletteSchema.safeParse(ref.palette ?? []).data ?? []
      return {
        referenceId: ref.id,
        x: Number(link.x ?? Number.NaN),
        y: Number(link.y ?? Number.NaN),
        width: Number(link.width ?? Number.NaN),
        height: Number(link.height ?? Number.NaN),
        z: link.z_index,
        caption: link.caption,
        title: ref.title,
        type: ref.type,
        ratio,
        color: palette[0]?.hex ?? null,
        thumbUrl: ref.thumbnail_key ? await presignGet(ref.thumbnail_key, VIEW_TTL_SECONDS) : null,
      }
    }),
  )

  const isPlaced = (i: BoardItem) => [i.x, i.y, i.width, i.height].every(Number.isFinite)
  const placed = items.filter(isPlaced)
  const fresh = items.filter((i) => !isPlaced(i))
  const positions = placeNew(placed, fresh)
  for (const item of fresh) Object.assign(item, positions.get(item.referenceId))

  return { items, placedNow: fresh.map((i) => i.referenceId) }
}

/** Fresh short-lived URLs for the export (the editor's may have expired). */
export async function getBoardMedia(supabase: ServerSupabase, projectId: string): Promise<BoardMedia[]> {
  const rows = await loadRows(supabase, projectId)
  return Promise.all(
    rows.map(async ({ ref }) => ({
      referenceId: ref.id,
      title: ref.title,
      thumbUrl: ref.thumbnail_key ? await presignGet(ref.thumbnail_key) : null,
      originalUrl: ref.type === "image" && ref.storage_key ? await presignGet(ref.storage_key) : null,
      mime: ref.type === "image" ? ref.mime_type : "image/jpeg",
    })),
  )
}
