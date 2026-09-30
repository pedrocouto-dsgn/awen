import { z } from "zod"

import { IMAGE_MIME_TYPES, LIMITS, VIDEO_MIME_TYPES } from "@/lib/media/limits"

export const paletteColorSchema = z.object({
  hex: z.string().regex(/^#[0-9a-f]{6}$/i),
  pct: z.number().min(0).max(100),
  lab: z.tuple([z.number(), z.number(), z.number()]),
})

export const paletteSchema = z.array(paletteColorSchema).max(8)

const techSchema = z.object({
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  duration: z.number().positive().max(24 * 3600).nullable().optional(),
  fps: z.number().positive().max(1000).nullable().optional(),
  palette: paletteSchema,
  phash: z.string().regex(/^[0-9a-f]{16}$/).nullable(),
})

const jpegPart = (max: number) => z.object({ size: z.number().int().positive().max(max) })

const fileSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("image"),
    name: z.string().max(300),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    size: z.number().int().positive().max(LIMITS.imageBytes),
  }),
  z.object({
    type: z.literal("video"),
    name: z.string().max(300),
    mimeType: z.enum(VIDEO_MIME_TYPES),
    size: z.number().int().positive().max(LIMITS.videoBytes),
  }),
])

export const createUploadSchema = z.object({
  /** Attach the file to an existing link-only reference instead of creating a new one. */
  attachTo: z.uuid().optional(),
  file: fileSchema,
  tech: techSchema,
  thumb: jpegPart(LIMITS.thumbBytes),
  frames: z.array(jpegPart(LIMITS.frameBytes)).max(LIMITS.maxFrames),
})

export type CreateUploadInput = z.infer<typeof createUploadSchema>

export const linkSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048)
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.url({ protocol: /^https?$/ })),
})

export type UploadTarget = { key: string; url: string; contentType: string }

export type DuplicateMatch = {
  id: string
  distance: number
  status: string
  title: string | null
}

export type CreateUploadResponse = {
  referenceId: string
  original: UploadTarget
  thumb: UploadTarget
  frames: UploadTarget[]
  duplicates: DuplicateMatch[]
}

export type LinkResponse = {
  referenceId: string
  provider: string
  title: string | null
  hasMedia: boolean
  duplicates: DuplicateMatch[]
}
