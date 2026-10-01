import { z } from "zod"

import type { Database } from "@/types/database"

// Labels, default lists and URL filters for the prompt library. Pure and isomorphic.

export type PromptType = Database["public"]["Enums"]["prompt_type"]
export type PromptStatus = Database["public"]["Enums"]["prompt_status"]
export type PromptOrigin = Database["public"]["Enums"]["prompt_origin"]

export const TYPE_LABEL: Record<PromptType, string> = {
  text_to_video: "Texto → vídeo",
  image_to_video: "Imagem → vídeo",
  image: "Imagem",
  edit: "Edição",
}

export const STATUS_LABEL: Record<PromptStatus, string> = {
  worked: "Funcionou",
  partial: "Funcionou em parte",
  failed: "Falhou",
}

export const ORIGIN_LABEL: Record<PromptOrigin, string> = {
  own: "Meu",
  third_party: "De terceiros",
}

/** Starting lists (Awen-Briefing). Names already used are added to them for autocomplete. */
export const DEFAULT_TOOLS = ["Magnific", "Runway", "Higgsfield"]
export const DEFAULT_MODELS = ["Nano Banana", "GPT Image", "Seedream", "Kling", "Seedance", "Google Omni"]

/** Optional generation parameters, stored in prompts.params. */
export const PARAM_FIELDS = [
  { key: "aspect_ratio", label: "Proporção", placeholder: "16:9" },
  { key: "duration", label: "Duração", placeholder: "5s" },
  { key: "resolution", label: "Resolução", placeholder: "1080p" },
  { key: "seed", label: "Seed", placeholder: "123456" },
] as const

export type PromptParamKey = (typeof PARAM_FIELDS)[number]["key"]
export type PromptParams = Partial<Record<PromptParamKey, string>>

export function readParams(value: unknown): PromptParams {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: PromptParams = {}
  for (const { key } of PARAM_FIELDS) {
    const v = (value as Record<string, unknown>)[key]
    if (typeof v === "string" && v.trim()) out[key] = v.trim()
    else if (typeof v === "number") out[key] = String(v)
  }
  return out
}

const enumOf = <T extends string>(values: Record<T, string>) =>
  z.enum(Object.keys(values) as [T, ...T[]]).optional().catch(undefined)

const text = (max: number) => z.string().trim().min(1).max(max).optional().catch(undefined)

export const promptFiltersSchema = z.object({
  q: text(200),
  ferramenta: text(80),
  modelo: text(80),
  tipo: enumOf(TYPE_LABEL),
  estado: enumOf(STATUS_LABEL),
  origem: enumOf(ORIGIN_LABEL),
  projeto: z.uuid().optional().catch(undefined),
  tag: text(40),
  /** "modelos": templates (prompts with {variables}) instead of regular prompts. */
  aba: z.enum(["modelos"]).optional().catch(undefined),
})

export type PromptFilters = z.infer<typeof promptFiltersSchema>

type RawParams = Record<string, string | string[] | undefined>

export function parsePromptFilters(params: RawParams | URLSearchParams): PromptFilters {
  const obj: Record<string, string | undefined> = {}
  if (params instanceof URLSearchParams) {
    for (const [k, v] of params) obj[k] = v
  } else {
    for (const [k, v] of Object.entries(params)) obj[k] = Array.isArray(v) ? v[0] : v
  }
  return promptFiltersSchema.parse(obj)
}

export function promptFiltersToParams(f: PromptFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.ferramenta) p.set("ferramenta", f.ferramenta)
  if (f.modelo) p.set("modelo", f.modelo)
  if (f.tipo) p.set("tipo", f.tipo)
  if (f.estado) p.set("estado", f.estado)
  if (f.origem) p.set("origem", f.origem)
  if (f.projeto) p.set("projeto", f.projeto)
  if (f.tag) p.set("tag", f.tag)
  if (f.aba) p.set("aba", f.aba)
  return p
}

export function countPromptFilters(f: PromptFilters): number {
  return [f.ferramenta, f.modelo, f.tipo, f.estado, f.origem, f.projeto, f.tag].filter(Boolean).length
}

/** {variable} names in a template, in order of first appearance. */
export function templateVariables(text: string): string[] {
  const names = new Set<string>()
  for (const m of text.matchAll(/\{([a-zA-Z][\w-]{0,39})\}/g)) names.add(m[1]!)
  return [...names]
}
