import { z } from "zod"

// Prompt analysis: the model reads a generation prompt (and its result, when there is
// one), suggests search tags and splits the text into sections. It organizes and
// labels only: section text is copied from the prompt, never written or improved.

export const SECTION_KEYS = ["subject", "setting", "camera", "lighting", "style", "motion", "audio"] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

export const SECTION_LABEL: Record<SectionKey, string> = {
  subject: "Assunto",
  setting: "Cenário",
  camera: "Câmera",
  lighting: "Luz",
  style: "Estilo",
  motion: "Movimento",
  audio: "Áudio",
}

const SECTION_HINT: Record<SectionKey, string> = {
  subject: "who or what is shown, appearance, wardrobe, action",
  setting: "location, environment, time of day, weather, props",
  camera: "shot size, framing, angle, lens, focus, composition",
  lighting: "light sources, quality, direction, contrast, time-of-day light",
  style: "look, film stock, grain, color grading, art style, references to artists or movies",
  motion: "camera movement and subject movement over time (video)",
  audio: "dialogue, voice, music, sound effects (video)",
}

export function promptAnalysisPrompt(ctx: { hasResult: boolean; tool: string | null; model: string | null; text: string }) {
  return [
    "You catalogue AI image and video generation prompts for a creative director.",
    ctx.hasResult ? "You are given the image the prompt generated (or a frame of the video), followed by the prompt." : "You are given the prompt only.",
    ctx.tool || ctx.model ? `It was used with: ${[ctx.model, ctx.tool].filter(Boolean).join(" on ")}.` : "",
    "Rules:",
    "- Do not write, rewrite, improve or translate the prompt.",
    "- sections: for each key, copy the exact fragments of the prompt that belong to it, in their original language, joined with \" … \" when they are apart. Use an empty string when the prompt says nothing about it. A fragment may appear in more than one section only if it truly covers both.",
    ...Object.entries(SECTION_HINT).map(([k, hint]) => `  - ${k}: ${hint}`),
    "- suggested_tags: lowercase English search tags (1-3 words each) about subject, look, technique and genre, using both the prompt and the result.",
    "",
    "Prompt:",
    "<<<",
    ctx.text,
    ">>>",
  ]
    .filter((line) => line !== "")
    .join("\n")
}

export const promptAnalysisJsonSchema = {
  type: "object",
  properties: {
    sections: {
      type: "object",
      properties: Object.fromEntries(SECTION_KEYS.map((k) => [k, { type: "string", description: SECTION_HINT[k] }])),
      required: [...SECTION_KEYS],
      propertyOrdering: [...SECTION_KEYS],
    },
    suggested_tags: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 12,
      description: "Lowercase English search tags, 1-3 words each.",
    },
  },
  required: ["sections", "suggested_tags"],
  propertyOrdering: ["sections", "suggested_tags"],
}

export const promptAnalysisOutputSchema = z.object({
  sections: z.object(Object.fromEntries(SECTION_KEYS.map((k) => [k, z.string().catch("")])) as Record<SectionKey, z.ZodCatch<z.ZodString>>),
  suggested_tags: z.array(z.string()).catch([]),
})

export type PromptAnalysisOutput = z.infer<typeof promptAnalysisOutputSchema>

/** Keeps sections that are actually in the prompt (the model must copy, not write). Pure. */
export function cleanSections(sections: Partial<Record<SectionKey, string>>, text: string): Partial<Record<SectionKey, string>> {
  const haystack = normalize(text)
  const out: Partial<Record<SectionKey, string>> = {}
  for (const key of SECTION_KEYS) {
    const value = sections[key]?.trim()
    if (!value) continue
    // Every fragment (split on the ellipsis the model uses to join them) must come from the text.
    const fragments = value.split(/\s*…\s*|\s*\.\.\.\s*/).map((f) => f.trim()).filter(Boolean)
    const kept = fragments.filter((f) => haystack.includes(normalize(f))).map((f) => f.replace(/[,;:]+$/, ""))
    if (kept.length) out[key] = kept.join(" … ").slice(0, 5000)
  }
  return out
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:]+$/g, "").trim()
}
