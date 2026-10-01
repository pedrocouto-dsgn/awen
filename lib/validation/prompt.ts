import { z } from "zod"

import { IMAGE_MIME_TYPES, LIMITS, VIDEO_MIME_TYPES } from "@/lib/media/limits"
import { ORIGIN_LABEL, PARAM_FIELDS, STATUS_LABEL, TYPE_LABEL } from "@/lib/prompts/options"

import { paletteSchema } from "./ingest"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))

const keysOf = <T extends string>(o: Record<T, string>) => Object.keys(o) as [T, ...T[]]

const paramsSchema = z
  .object(Object.fromEntries(PARAM_FIELDS.map((f) => [f.key, z.string().trim().max(40).optional()])))
  .partial()
  .transform((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v)))

/** Fields of a prompt entry. The text has no length limit beyond a sanity cap. */
export const promptFieldsSchema = z.object({
  prompt_text: z.string().min(1, "Escreva ou cole o prompt.").max(200_000),
  title: optionalText(200),
  tool: optionalText(80),
  model: optionalText(80),
  type: z.enum(keysOf(TYPE_LABEL)).nullable().optional().default(null),
  status: z.enum(keysOf(STATUS_LABEL)).nullable().optional().default(null),
  origin: z.enum(keysOf(ORIGIN_LABEL)).default("own"),
  author: optionalText(120),
  source_url: z
    .string()
    .trim()
    .max(2048)
    .nullable()
    .optional()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
    .pipe(z.url({ protocol: /^https?$/ }).nullable()),
  notes: optionalText(20_000),
  version_note: optionalText(2_000),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30).default([]),
  params: paramsSchema.default({}),
  is_template: z.boolean().default(false),
  /** References that inspired the prompt (replaces the current set). */
  referenceIds: z.array(z.uuid()).max(50).default([]),
  /** Projects the prompt was used in (replaces the current set). */
  projectIds: z.array(z.uuid()).max(50).default([]),
})

export const promptCreateSchema = promptFieldsSchema.extend({
  /** New version of this prompt (v2, v3…). */
  parentId: z.uuid().nullable().optional(),
})

export type PromptFieldsInput = z.input<typeof promptFieldsSchema>

const fileSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("image"),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    size: z.number().int().positive().max(LIMITS.imageBytes),
  }),
  z.object({
    type: z.literal("video"),
    mimeType: z.enum(VIDEO_MIME_TYPES),
    size: z.number().int().positive().max(LIMITS.videoBytes),
  }),
])

/** A result or input: an uploaded file (presigned) or an existing reference. */
export const promptAssetCreateSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("file"),
    role: z.enum(["result", "input"]),
    file: fileSchema,
    tech: z.object({
      width: z.number().int().positive().max(20000),
      height: z.number().int().positive().max(20000),
      duration: z.number().positive().max(24 * 3600).nullable().optional(),
      palette: paletteSchema,
    }),
    thumb: z.object({ size: z.number().int().positive().max(LIMITS.thumbBytes) }),
  }),
  z.object({
    source: z.literal("reference"),
    role: z.enum(["result", "input"]),
    referenceId: z.uuid(),
  }),
])

export type PromptAssetCreateInput = z.infer<typeof promptAssetCreateSchema>

export type PromptAssetCreateResponse = {
  assetId: string
  upload?: {
    original: { url: string; contentType: string }
    thumb: { url: string; contentType: string }
  }
}

/** A reusable piece of prompt text (lighting setup, camera system, materials…). */
export const promptBlockSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao bloco.").max(80),
  category: optionalText(40),
  body: z.string().trim().min(1, "O bloco está vazio.").max(50_000),
})
