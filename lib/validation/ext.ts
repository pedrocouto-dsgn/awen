import { z } from "zod"

import { IMAGE_MIME_TYPES, LIMITS } from "@/lib/media/limits"

import { linkSchema } from "./ingest"

const optionalUrl = z.url({ protocol: /^https?$/ }).max(2048).optional()

export const extSaveSchema = z.discriminatedUnion("kind", [
  // A page or a video: resolved server-side like a pasted link.
  z.object({ kind: z.literal("link"), url: linkSchema.shape.url, toProject: z.boolean().default(false) }),
  // An image the extension downloaded itself and will upload to R2.
  z.object({
    kind: z.literal("image"),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    size: z.number().int().positive().max(LIMITS.imageBytes),
    srcUrl: optionalUrl,
    pageUrl: optionalUrl,
    pageTitle: z.string().max(500).optional(),
    toProject: z.boolean().default(false),
  }),
])

export type ExtSaveInput = z.infer<typeof extSaveSchema>

export type ExtSaveResponse = {
  referenceId: string
  /** Present for images: PUT the bytes here, then call finalize. */
  upload?: { url: string; contentType: string }
  project: { id: string; name: string } | null
}

export type ExtMeResponse = {
  email: string | null
  activeProject: { id: string; name: string } | null
}

export const createTokenSchema = z.object({ name: z.string().trim().min(1).max(60) })

export type TokenView = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export const TOKEN_COLUMNS = "id, name, token_prefix, created_at, last_used_at"

export function toTokenView(row: {
  id: string
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
}): TokenView {
  return { id: row.id, name: row.name, prefix: row.token_prefix, createdAt: row.created_at, lastUsedAt: row.last_used_at }
}
