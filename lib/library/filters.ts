import { z } from "zod"

// Library filters live in the URL (shareable, back-button friendly). Pure and isomorphic.

export const ASPECT_BUCKETS = {
  vertical: { label: "Vertical (9:16)", min: 0, max: 0.7 },
  retrato: { label: "Retrato (4:5)", min: 0.7, max: 0.95 },
  quadrado: { label: "Quadrado (1:1)", min: 0.95, max: 1.05 },
  classico: { label: "Clássico (4:3 · 3:2)", min: 1.05, max: 1.6 },
  wide: { label: "Widescreen (16:9)", min: 1.6, max: 2.0 },
  scope: { label: "Scope (2.39:1)", min: 2.0, max: 10 },
} as const

export const SINCE_OPTIONS = {
  "7d": { label: "Últimos 7 dias", days: 7 },
  "30d": { label: "Últimos 30 dias", days: 30 },
  "90d": { label: "Últimos 3 meses", days: 90 },
  "365d": { label: "Último ano", days: 365 },
} as const

export const SOURCE_OPTIONS = {
  upload: "Upload",
  youtube: "YouTube",
  vimeo: "Vimeo",
  link: "Link",
} as const

const list = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20)
      : [],
  )

export const libraryFiltersSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  plano: list.catch([]),
  clima: list.catch([]),
  luz: list.catch([]),
  formato: z.enum(Object.keys(ASPECT_BUCKETS) as [keyof typeof ASPECT_BUCKETS]).optional().catch(undefined),
  pessoa: z.uuid().optional().catch(undefined),
  projeto: z.uuid().optional().catch(undefined),
  tipo: z.enum(["image", "video"]).optional().catch(undefined),
  fonte: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter((s): s is keyof typeof SOURCE_OPTIONS => s in SOURCE_OPTIONS) : []))
    .catch([]),
  desde: z.enum(Object.keys(SINCE_OPTIONS) as [keyof typeof SINCE_OPTIONS]).optional().catch(undefined),
  nota: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  cor: z
    .string()
    .regex(/^[0-9a-f]{6}$/i)
    .optional()
    .catch(undefined),
  /** "Parecidas": neighbours of this reference. */
  parecida: z.uuid().optional().catch(undefined),
  /** Search by an image dropped on the search box (search_queries id). */
  imagem: z.uuid().optional().catch(undefined),
})

export type LibraryFilters = z.infer<typeof libraryFiltersSchema>

type RawParams = Record<string, string | string[] | undefined>

export function parseFilters(params: RawParams | URLSearchParams): LibraryFilters {
  const obj: Record<string, string | undefined> = {}
  if (params instanceof URLSearchParams) {
    for (const [k, v] of params) obj[k] = v
  } else {
    for (const [k, v] of Object.entries(params)) obj[k] = Array.isArray(v) ? v[0] : v
  }
  return libraryFiltersSchema.parse(obj)
}

/** Serializes filters back to URL params (only non-empty values). */
export function filtersToParams(f: LibraryFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.plano.length) p.set("plano", f.plano.join(","))
  if (f.clima.length) p.set("clima", f.clima.join(","))
  if (f.luz.length) p.set("luz", f.luz.join(","))
  if (f.formato) p.set("formato", f.formato)
  if (f.pessoa) p.set("pessoa", f.pessoa)
  if (f.projeto) p.set("projeto", f.projeto)
  if (f.tipo) p.set("tipo", f.tipo)
  if (f.fonte.length) p.set("fonte", f.fonte.join(","))
  if (f.desde) p.set("desde", f.desde)
  if (f.nota) p.set("nota", String(f.nota))
  if (f.cor) p.set("cor", f.cor.toLowerCase())
  if (f.parecida) p.set("parecida", f.parecida)
  if (f.imagem) p.set("imagem", f.imagem)
  return p
}

/** Searching by image (an existing reference or a dropped file) instead of by text. */
export function isVisualSearch(f: LibraryFilters): boolean {
  return Boolean(f.parecida || f.imagem)
}

export function countActiveFilters(f: LibraryFilters): number {
  return (
    f.plano.length +
    f.clima.length +
    f.luz.length +
    f.fonte.length +
    [f.formato, f.pessoa, f.projeto, f.tipo, f.desde, f.nota].filter(Boolean).length
  )
}
