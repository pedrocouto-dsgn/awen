import "server-only"

import { hexToLab } from "@/lib/palette"
import { presignGet } from "@/lib/r2/presign"
import { VIEW_TTL_SECONDS } from "@/lib/references/view"
import type { ServerSupabase } from "@/lib/supabase/server"
import type { Reference } from "@/types/database"

import { ASPECT_BUCKETS, SINCE_OPTIONS, type LibraryFilters } from "./filters"

export const PAGE_SIZE = 48
const COLOR_MAX_DISTANCE = 25

/** Minimal data for a grid card, with short-lived URLs. */
export type LibraryCard = {
  id: string
  title: string | null
  type: Reference["type"]
  sourceKind: Reference["source_kind"]
  width: number | null
  height: number | null
  aspectRatio: number | null
  duration: number | null
  rating: number | null
  shotType: string | null
  mood: string[]
  palette: { hex: string; pct: number }[]
  thumbUrl: string | null
  /** Muted hover preview for uploaded videos. */
  previewUrl: string | null
}

const CARD_COLUMNS =
  "id, title, type, source_kind, width, height, aspect_ratio, duration, rating, shot_type, mood, palette, thumbnail_key, storage_key"

export async function searchLibrary(
  supabase: ServerSupabase,
  filters: LibraryFilters,
  offset = 0,
): Promise<{ cards: LibraryCard[]; total: number; nextOffset: number | null }> {
  const aspect = filters.formato ? ASPECT_BUCKETS[filters.formato] : null
  const since = filters.desde
    ? new Date(Date.now() - SINCE_OPTIONS[filters.desde].days * 86_400_000).toISOString()
    : null
  const lab = filters.cor ? hexToLab(`#${filters.cor}`) : null

  const { data, error, count } = await supabase
    .rpc(
      "search_references",
      {
        p_query: filters.q ?? null,
        p_shot_types: filters.plano.length ? filters.plano : null,
        p_moods: filters.clima.length ? filters.clima : null,
        p_lighting: filters.luz.length ? filters.luz : null,
        p_aspect_min: aspect?.min ?? null,
        p_aspect_max: aspect?.max ?? null,
        p_person_id: filters.pessoa ?? null,
        p_project_id: filters.projeto ?? null,
        p_type: filters.tipo ?? null,
        p_source_kinds: filters.fonte.length ? filters.fonte : null,
        p_date_from: since,
        p_min_rating: filters.nota ?? null,
        p_color_lab: lab,
        p_color_max_distance: COLOR_MAX_DISTANCE,
        p_status: "approved",
      },
      { count: "exact" },
    )
    .select(CARD_COLUMNS)
    .range(offset, offset + PAGE_SIZE - 1)
  if (error) throw error

  const rows = (data ?? []) as unknown as Pick<
    Reference,
    | "id"
    | "title"
    | "type"
    | "source_kind"
    | "width"
    | "height"
    | "aspect_ratio"
    | "duration"
    | "rating"
    | "shot_type"
    | "mood"
    | "palette"
    | "thumbnail_key"
    | "storage_key"
  >[]

  const cards = await Promise.all(
    rows.map(async (r) => {
      const [thumbUrl, previewUrl] = await Promise.all([
        r.thumbnail_key ? presignGet(r.thumbnail_key, VIEW_TTL_SECONDS) : null,
        r.type === "video" && r.source_kind === "upload" && r.storage_key
          ? presignGet(r.storage_key, VIEW_TTL_SECONDS)
          : null,
      ])
      const palette = Array.isArray(r.palette)
        ? (r.palette as { hex?: unknown; pct?: unknown }[])
            .filter((c) => typeof c.hex === "string" && typeof c.pct === "number")
            .map((c) => ({ hex: c.hex as string, pct: c.pct as number }))
        : []
      return {
        id: r.id,
        title: r.title,
        type: r.type,
        sourceKind: r.source_kind,
        width: r.width,
        height: r.height,
        aspectRatio: r.aspect_ratio,
        duration: r.duration,
        rating: r.rating,
        shotType: r.shot_type,
        mood: r.mood,
        palette,
        thumbUrl,
        previewUrl,
      } satisfies LibraryCard
    }),
  )

  const total = count ?? cards.length
  const next = offset + cards.length
  return { cards, total, nextOffset: next < total ? next : null }
}
