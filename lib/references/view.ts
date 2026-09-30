import "server-only"

import { z } from "zod"

import { presignGet } from "@/lib/r2/presign"
import { paletteSchema } from "@/lib/validation/ingest"
import type { Reference, VocabCategory } from "@/types/database"

// Serializable reference shape for client components, with short-lived media URLs.

export type MediaView =
  | { kind: "image"; src: string; thumb: string | null }
  | { kind: "video"; src: string; poster: string | null; frames: string[] }
  | { kind: "embed"; provider: "youtube" | "vimeo"; embedUrl: string; poster: string | null }
  | { kind: "none"; poster: string | null }

export type AiSuggestion = {
  suggestedTerms: Partial<Record<VocabCategory, string[]>>
  artist: { name: string | null; confidence: "low" | "medium" | "high" } | null
  model: string | null
  input: string | null
}

export type ReferenceView = Omit<Reference, "search_tsv" | "embedding" | "ai" | "palette" | "source_meta"> & {
  palette: z.infer<typeof paletteSchema>
  sourceMeta: { provider?: string; author?: string | null; siteName?: string | null; host?: string }
  media: MediaView
  ai: AiSuggestion | null
}

const metaSchema = z
  .object({
    provider: z.string().optional(),
    embedUrl: z.string().optional(),
    videoId: z.string().optional(),
    author: z.string().nullable().optional(),
    siteName: z.string().nullable().optional(),
    host: z.string().optional(),
  })
  .partial()

const aiSchema = z
  .object({
    model: z.string().optional(),
    input: z.string().optional(),
    suggested_terms: z.record(z.string(), z.array(z.string())).optional(),
    output: z
      .object({
        possible_artist_or_director: z
          .object({ name: z.string().nullable(), confidence: z.enum(["low", "medium", "high"]) })
          .optional(),
      })
      .partial()
      .optional(),
  })
  .partial()

export const VIEW_TTL_SECONDS = 60 * 60

/** Vimeo unlisted videos need their privacy hash on the player URL. */
function vimeoEmbed(meta: z.infer<typeof metaSchema>, sourceUrl: string | null): string | null {
  if (!meta.embedUrl) return null
  const hash = sourceUrl ? /vimeo\.com\/\d+\/([a-f0-9]{6,})/i.exec(sourceUrl)?.[1] : undefined
  return hash ? `${meta.embedUrl}?h=${hash}` : meta.embedUrl
}

export async function toReferenceView(ref: Reference): Promise<ReferenceView> {
  const sign = (key: string | null) => (key ? presignGet(key, VIEW_TTL_SECONDS) : Promise.resolve(null))
  const [original, thumb, ...frames] = await Promise.all([
    sign(ref.storage_key),
    sign(ref.thumbnail_key),
    ...ref.frame_keys.map((k) => sign(k)),
  ])

  const meta = metaSchema.safeParse(ref.source_meta ?? {}).data ?? {}
  let media: MediaView
  if ((ref.source_kind === "youtube" || ref.source_kind === "vimeo") && meta.embedUrl) {
    const embedUrl = ref.source_kind === "vimeo" ? vimeoEmbed(meta, ref.source_url) : meta.embedUrl
    media = { kind: "embed", provider: ref.source_kind, embedUrl: embedUrl ?? meta.embedUrl, poster: thumb }
  } else if (ref.type === "video" && original) {
    media = { kind: "video", src: original, poster: thumb, frames: frames.filter((f): f is string => Boolean(f)) }
  } else if (original || thumb) {
    media = { kind: "image", src: (original ?? thumb)!, thumb }
  } else {
    media = { kind: "none", poster: null }
  }

  const ai = ref.ai ? aiSchema.safeParse(ref.ai).data : undefined
  const { search_tsv: _t, embedding: _e, ai: _a, palette, source_meta: _m, ...rest } = ref
  void _t
  void _e
  void _a
  void _m

  return {
    ...rest,
    palette: paletteSchema.safeParse(palette ?? []).data ?? [],
    sourceMeta: { provider: meta.provider, author: meta.author, siteName: meta.siteName, host: meta.host },
    media,
    ai: ai
      ? {
          suggestedTerms: (ai.suggested_terms ?? {}) as AiSuggestion["suggestedTerms"],
          artist: ai.output?.possible_artist_or_director ?? null,
          model: ai.model ?? null,
          input: ai.input ?? null,
        }
      : null,
  }
}
