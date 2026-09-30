import { z } from "zod"

import type { VocabCategory } from "@/types/database"

// Structured output for reference analysis. Vocabulary fields are constrained to
// the user's current terms plus "other"; "other" comes with a suggested new term.

export const OTHER = "other"

export type Vocabularies = Record<VocabCategory, string[]>

const single = (terms: string[], description: string) => ({
  type: "object",
  description,
  properties: {
    value: { type: "string", enum: [...terms, OTHER] },
    suggested_new_term: {
      type: ["string", "null"],
      description: `Only when value is "${OTHER}": a short new English term (1-3 words, lowercase). Otherwise null.`,
    },
  },
  required: ["value", "suggested_new_term"],
})

const multi = (terms: string[], description: string) => ({
  type: "object",
  description,
  properties: {
    values: { type: "array", items: { type: "string", enum: terms }, maxItems: 4 },
    suggested_new_terms: {
      type: "array",
      items: { type: "string" },
      maxItems: 2,
      description: "New English terms (1-3 words, lowercase) only if nothing in the list fits. Usually empty.",
    },
  },
  required: ["values", "suggested_new_terms"],
})

/** JSON Schema passed to Gemini as responseJsonSchema. */
export function analysisJsonSchema(vocab: Vocabularies, isVideo: boolean) {
  const properties: Record<string, unknown> = {
    shot_type: single(vocab.shot_type, "Shot size / framing."),
    camera_angle: single(vocab.camera_angle, "Camera angle relative to the subject."),
    ...(isVideo ? { camera_movement: single(vocab.camera_movement, "Dominant camera movement in the clip.") } : {}),
    lighting: multi(vocab.lighting, "Lighting characteristics (1-3 items)."),
    mood: multi(vocab.mood, "Emotional tone (1-3 items)."),
    visual_style: { type: "string", description: "Short free text, max 8 words (e.g. 'bleach bypass neo-noir')." },
    texture_grain: { type: "string", description: "Texture / grain / sharpness, max 6 words (e.g. 'heavy 35mm grain')." },
    setting: { type: "string", description: "Where it happens, max 6 words." },
    era: { type: "string", description: "Period the image evokes, max 4 words (e.g. '1970s', 'contemporary')." },
    subject: { type: "string", description: "Main subject, max 8 words." },
    description: { type: "string", description: "2-3 sentences describing the image as a visual reference." },
    suggested_tags: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 12,
      description: "Lowercase English search tags, 1-3 words each.",
    },
    possible_artist_or_director: {
      type: "object",
      description:
        "A guess of the photographer/director/artist whose work this resembles or is. Always a suggestion. name is null when there is no reasonable guess.",
      properties: {
        name: { type: ["string", "null"] },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["name", "confidence"],
    },
  }
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    propertyOrdering: Object.keys(properties),
  }
}

// Zod mirror of the schema: validates what the model returns.
const singleZ = z.object({ value: z.string(), suggested_new_term: z.string().nullable().optional() })
const multiZ = z.object({
  values: z.array(z.string()).default([]),
  suggested_new_terms: z.array(z.string()).default([]),
})

export const analysisOutputSchema = z.object({
  shot_type: singleZ,
  camera_angle: singleZ,
  camera_movement: singleZ.optional(),
  lighting: multiZ,
  mood: multiZ,
  visual_style: z.string(),
  texture_grain: z.string(),
  setting: z.string(),
  era: z.string(),
  subject: z.string(),
  description: z.string(),
  suggested_tags: z.array(z.string()),
  possible_artist_or_director: z.object({
    name: z.string().nullable(),
    confidence: z.enum(["low", "medium", "high"]),
  }),
})

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>
