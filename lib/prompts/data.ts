import "server-only"

import { presignGet } from "@/lib/r2/presign"
import { VIEW_TTL_SECONDS } from "@/lib/references/view"
import type { ServerSupabase } from "@/lib/supabase/server"
import { paletteSchema } from "@/lib/validation/ingest"
import type { Prompt, PromptAsset } from "@/types/database"

import { DEFAULT_MODELS, DEFAULT_TOOLS, readParams, type PromptFilters, type PromptParams } from "./options"

export const PROMPT_PAGE_SIZE = 40
const EXCERPT_LENGTH = 280
const CARD_COLUMNS = "id, title, prompt_text, tool, model, type, status, origin, is_template"

/** Minimal data for a prompt card in the grid. */
export type PromptCard = {
  id: string
  title: string | null
  excerpt: string
  length: number
  tool: string | null
  model: string | null
  type: Prompt["type"]
  status: Prompt["status"]
  origin: Prompt["origin"]
  isTemplate: boolean
  /** First result, if any. */
  result: { kind: "image" | "video"; thumbUrl: string | null; aspectRatio: number | null; color: string | null } | null
}

/** A result or input, with short-lived URLs. */
export type PromptAssetView = {
  id: string
  role: PromptAsset["role"]
  kind: "image" | "video"
  /** Full file (video plays from it); null for a reference without a stored file. */
  src: string | null
  thumbUrl: string | null
  width: number | null
  height: number | null
  ready: boolean
  /** Set when the asset is an existing library reference. */
  reference: { id: string; title: string | null } | null
}

export type PromptVersion = { id: string; number: number; createdAt: string; note: string | null }

export type PromptView = Omit<Prompt, "search_tsv" | "params" | "owner_id"> & {
  params: PromptParams
  results: PromptAssetView[]
  inputs: PromptAssetView[]
  references: { id: string; title: string | null; thumbUrl: string | null }[]
  projects: { id: string; name: string }[]
  versions: PromptVersion[]
}

const sign = (key: string | null | undefined) => (key ? presignGet(key, VIEW_TTL_SECONDS) : Promise.resolve(null))

export async function searchPrompts(
  supabase: ServerSupabase,
  filters: PromptFilters,
  offset = 0,
): Promise<{ cards: PromptCard[]; total: number; nextOffset: number | null }> {
  const { data, error, count } = await supabase
    .rpc(
      "search_prompts",
      {
        p_query: filters.q ?? null,
        p_tool: filters.ferramenta ?? null,
        p_model: filters.modelo ?? null,
        p_type: filters.tipo ?? null,
        p_status: filters.estado ?? null,
        p_origin: filters.origem ?? null,
        p_project_id: filters.projeto ?? null,
        p_tag: filters.tag ?? null,
        p_templates: filters.aba === "modelos",
      },
      { count: "exact" },
    )
    .select(CARD_COLUMNS)
    .range(offset, offset + PROMPT_PAGE_SIZE - 1)
  if (error) throw error

  const cards = await toCards(supabase, (data ?? []) as CardRow[])
  const total = count ?? cards.length
  const next = offset + cards.length
  return { cards, total, nextOffset: next < total ? next : null }
}

/** First result of each prompt, as a card preview. */
async function firstResults(supabase: ServerSupabase, promptIds: string[]): Promise<Map<string, PromptCard["result"]>> {
  const out = new Map<string, PromptCard["result"]>()
  if (promptIds.length === 0) return out
  const { data, error } = await supabase
    .from("prompt_assets")
    .select("prompt_id, kind, thumbnail_key, width, height, palette, reference_id, media_ready, sort_order, created_at")
    .in("prompt_id", promptIds)
    .eq("role", "result")
    .order("sort_order")
    .order("created_at")
  if (error) throw error

  const first = new Map<string, (typeof data)[number]>()
  for (const a of data ?? []) if (!first.has(a.prompt_id) && (a.media_ready || a.reference_id)) first.set(a.prompt_id, a)
  const refs = await referencePreviews(
    supabase,
    [...first.values()].map((a) => a.reference_id),
  )

  await Promise.all(
    [...first.entries()].map(async ([promptId, a]) => {
      const ref = a.reference_id ? refs.get(a.reference_id) : undefined
      const width = ref?.width ?? a.width
      const height = ref?.height ?? a.height
      const palette = paletteSchema.safeParse(ref?.palette ?? a.palette ?? []).data ?? []
      out.set(promptId, {
        kind: (ref?.type ?? a.kind ?? "image") as "image" | "video",
        thumbUrl: await sign(ref?.thumbnail_key ?? a.thumbnail_key),
        aspectRatio: width && height ? width / height : null,
        color: palette[0]?.hex ?? null,
      })
    }),
  )
  return out
}

type RefPreview = {
  id: string
  title: string | null
  type: "image" | "video"
  thumbnail_key: string | null
  storage_key: string | null
  width: number | null
  height: number | null
  palette: unknown
}

async function referencePreviews(supabase: ServerSupabase, ids: (string | null)[]): Promise<Map<string, RefPreview>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (wanted.length === 0) return new Map()
  const { data, error } = await supabase
    .from("references")
    .select("id, title, type, thumbnail_key, storage_key, width, height, palette")
    .in("id", wanted)
  if (error) throw error
  return new Map((data ?? []).map((r) => [r.id, r as RefPreview]))
}

export async function loadPrompt(supabase: ServerSupabase, id: string): Promise<PromptView | null> {
  const { data: prompt, error } = await supabase.from("prompts").select("*").eq("id", id).maybeSingle()
  if (error) throw error
  if (!prompt) return null

  const [assets, links, projectLinks, versions] = await Promise.all([
    supabase.from("prompt_assets").select("*").eq("prompt_id", id).order("sort_order").order("created_at"),
    supabase.from("prompt_references").select("reference_id, created_at").eq("prompt_id", id).order("created_at"),
    supabase.from("prompt_projects").select("project_id").eq("prompt_id", id),
    versionChain(supabase, prompt),
  ])
  if (assets.error) throw assets.error
  if (links.error) throw links.error
  if (projectLinks.error) throw projectLinks.error

  const refIds = [
    ...(assets.data ?? []).map((a) => a.reference_id),
    ...(links.data ?? []).map((l) => l.reference_id),
  ]
  const projectIds = (projectLinks.data ?? []).map((p) => p.project_id)
  const [refs, projects] = await Promise.all([
    referencePreviews(supabase, refIds),
    projectIds.length
      ? supabase.from("projects").select("id, name").in("id", projectIds).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ])
  if (projects.error) throw projects.error

  const assetViews = await Promise.all(
    (assets.data ?? []).map(async (a): Promise<PromptAssetView> => {
      const ref = a.reference_id ? refs.get(a.reference_id) : undefined
      const kind = (ref?.type ?? a.kind ?? "image") as "image" | "video"
      const [src, thumbUrl] = await Promise.all([
        sign(a.media_ready ? a.storage_key : (ref?.storage_key ?? null)),
        sign(ref?.thumbnail_key ?? a.thumbnail_key),
      ])
      return {
        id: a.id,
        role: a.role,
        kind,
        src,
        thumbUrl,
        width: ref?.width ?? a.width,
        height: ref?.height ?? a.height,
        ready: a.media_ready || Boolean(ref),
        reference: ref ? { id: ref.id, title: ref.title } : null,
      }
    }),
  )

  const references = await Promise.all(
    (links.data ?? [])
      .map((l) => refs.get(l.reference_id))
      .filter((r): r is RefPreview => Boolean(r))
      .map(async (r) => ({ id: r.id, title: r.title, thumbUrl: await sign(r.thumbnail_key) })),
  )

  const { search_tsv: _t, params, owner_id: _o, ...rest } = prompt
  void _t
  void _o
  return {
    ...rest,
    params: readParams(params),
    results: assetViews.filter((a) => a.role === "result"),
    inputs: assetViews.filter((a) => a.role === "input"),
    references,
    projects: projects.data ?? [],
    versions,
  }
}

/** Every version in this prompt's chain, oldest first (v1, v2…). Chains are short. */
async function versionChain(supabase: ServerSupabase, prompt: Prompt): Promise<PromptVersion[]> {
  type Row = Pick<Prompt, "id" | "parent_prompt_id" | "created_at" | "version_note">
  const byId = new Map<string, Row>([[prompt.id, prompt]])

  // Up to the root.
  let root: Row = prompt
  for (let i = 0; i < 50 && root.parent_prompt_id; i++) {
    const { data } = await supabase
      .from("prompts")
      .select("id, parent_prompt_id, created_at, version_note")
      .eq("id", root.parent_prompt_id)
      .maybeSingle()
    if (!data) break
    byId.set(data.id, data)
    root = data
  }

  // Down from the root, level by level.
  let level = [root.id]
  for (let i = 0; i < 50 && level.length > 0; i++) {
    const { data } = await supabase
      .from("prompts")
      .select("id, parent_prompt_id, created_at, version_note")
      .in("parent_prompt_id", level)
    const children = (data ?? []).filter((c) => !byId.has(c.id))
    for (const c of children) byId.set(c.id, c)
    level = children.map((c) => c.id)
  }

  return [...byId.values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((v, i) => ({ id: v.id, number: i + 1, createdAt: v.created_at, note: v.version_note }))
}

/** Prompts linked to a reference (inspired by it, or using it as result/input), newest first. */
export async function promptsForReference(supabase: ServerSupabase, referenceId: string): Promise<PromptCard[]> {
  const [linked, used] = await Promise.all([
    supabase.from("prompt_references").select("prompt_id").eq("reference_id", referenceId),
    supabase.from("prompt_assets").select("prompt_id").eq("reference_id", referenceId),
  ])
  const ids = [...new Set([...(linked.data ?? []), ...(used.data ?? [])].map((r) => r.prompt_id))]
  return promptCardsByIds(supabase, ids)
}

/** Prompts used in a project, newest first. */
export async function promptsForProject(supabase: ServerSupabase, projectId: string): Promise<PromptCard[]> {
  const { data } = await supabase.from("prompt_projects").select("prompt_id").eq("project_id", projectId)
  return promptCardsByIds(
    supabase,
    (data ?? []).map((r) => r.prompt_id),
  )
}

async function promptCardsByIds(supabase: ServerSupabase, ids: string[]): Promise<PromptCard[]> {
  if (ids.length === 0) return []
  const wanted = ids.slice(0, 100)
  const [rows, kids] = await Promise.all([
    supabase.from("prompts").select(CARD_COLUMNS).in("id", wanted).order("updated_at", { ascending: false }),
    supabase.from("prompts").select("id, parent_prompt_id").in("parent_prompt_id", wanted),
  ])
  if (rows.error) throw rows.error
  // When v1 and v2 are both linked, list only the newer one.
  const set = new Set(wanted)
  const superseded = new Set<string>()
  for (const k of kids.data ?? []) if (k.parent_prompt_id && set.has(k.id)) superseded.add(k.parent_prompt_id)
  return toCards(
    supabase,
    (rows.data ?? []).filter((r) => !superseded.has(r.id)),
  )
}

type CardRow = Pick<Prompt, "id" | "title" | "prompt_text" | "tool" | "model" | "type" | "status" | "origin" | "is_template">

async function toCards(supabase: ServerSupabase, rows: CardRow[]): Promise<PromptCard[]> {
  const results = await firstResults(
    supabase,
    rows.map((r) => r.id),
  )
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: r.prompt_text.length > EXCERPT_LENGTH ? `${r.prompt_text.slice(0, EXCERPT_LENGTH).trimEnd()}…` : r.prompt_text,
    length: r.prompt_text.length,
    tool: r.tool,
    model: r.model,
    type: r.type,
    status: r.status,
    origin: r.origin,
    isTemplate: r.is_template,
    result: results.get(r.id) ?? null,
  }))
}

/** Tool and model names for autocomplete: defaults plus everything already used. */
export async function toolSuggestions(
  supabase: ServerSupabase,
): Promise<{ tools: string[]; models: string[] }> {
  const { data } = await supabase.rpc("prompt_tool_names")
  const used = (field: "tool" | "model") => (data ?? []).filter((r) => r.field === field).map((r) => r.name)
  const merge = (a: string[], b: string[]) => {
    const seen = new Set<string>()
    return [...a, ...b].filter((n) => {
      const k = n.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  return { tools: merge(used("tool"), DEFAULT_TOOLS), models: merge(used("model"), DEFAULT_MODELS) }
}
