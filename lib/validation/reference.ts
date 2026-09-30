import { z } from "zod"

const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? null : v))
    .nullable()

const term = z.string().trim().min(1).max(60)

export const referenceUpdateSchema = z
  .object({
    title: text(300),
    shot_type: term.nullable(),
    camera_angle: term.nullable(),
    camera_movement: term.nullable(),
    lighting: z.array(term).max(8),
    mood: z.array(term).max(8),
    visual_style: text(200),
    texture_grain: text(200),
    setting: text(200),
    era: text(100),
    subject: text(200),
    description: text(2000),
    tags: z
      .array(z.string().trim().toLowerCase().min(1).max(40))
      .max(30)
      .transform((t) => [...new Set(t)]),
    rating: z.number().int().min(1).max(5).nullable(),
    notes: text(10000),
    status: z.enum(["approved", "rejected", "pending"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar." })

export type ReferenceUpdate = z.infer<typeof referenceUpdateSchema>

export const vocabTermSchema = z.object({
  category: z.enum(["shot_type", "camera_angle", "camera_movement", "lighting", "mood"]),
  term: z
    .string()
    .trim()
    .min(1, "Informe o termo.")
    .max(60, "Termo longo demais.")
    .transform((v) => v.replace(/\s+/g, " ")),
})

export const vocabTermUpdateSchema = z
  .object({
    term: vocabTermSchema.shape.term,
    archived: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar." })

export const vocabOrderSchema = z.object({
  category: vocabTermSchema.shape.category,
  ids: z.array(z.uuid()).min(1).max(500),
})
