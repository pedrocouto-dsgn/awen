import { z } from "zod"

const name = z
  .string()
  .trim()
  .min(1, "Informe o nome.")
  .max(120, "Nome longo demais.")
  .transform((v) => v.replace(/\s+/g, " "))

export const personRoleSchema = z.enum(["director", "photographer", "artist"])

export const personCreateSchema = z.object({ name })
export const personUpdateSchema = z.object({ name })

/** Link by existing person id, or by name (created if missing). */
export const referencePersonLinkSchema = z
  .object({
    personId: z.uuid().optional(),
    name: name.optional(),
    role: personRoleSchema,
  })
  .refine((v) => Boolean(v.personId) !== Boolean(v.name), { message: "Informe o artista." })

export const referencePersonUnlinkSchema = z.object({ personId: z.uuid(), role: personRoleSchema })

export const projectCreateSchema = z.object({
  name,
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
})

export const projectUpdateSchema = projectCreateSchema
  .partial()
  .extend({ is_active: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar." })

export const projectItemsSchema = z.object({ referenceIds: z.array(z.uuid()).min(1).max(200) })

export const ROLE_LABEL = { director: "Direção", photographer: "Fotografia", artist: "Arte" } as const

const boardCoord = z.number().finite().min(-100_000).max(100_000)

/** Moodboard save: only the items that changed. */
export const boardSaveSchema = z.object({
  items: z
    .array(
      z.object({
        referenceId: z.uuid(),
        x: boardCoord,
        y: boardCoord,
        width: z.number().finite().positive().max(100_000),
        height: z.number().finite().positive().max(100_000),
        z: z.number().int().min(-1_000_000).max(1_000_000),
        caption: z
          .string()
          .trim()
          .max(300)
          .transform((v) => (v === "" ? null : v))
          .nullable(),
      }),
    )
    .min(1)
    .max(500),
})
