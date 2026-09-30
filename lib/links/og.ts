// Minimal Open Graph / meta tag extraction. Pure.

export type OgData = {
  title?: string
  image?: string
  video?: string
  siteName?: string
  description?: string
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " }

function decode(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
      const k = e.toLowerCase()
      if (k.startsWith("#x")) return String.fromCodePoint(Number.parseInt(k.slice(2), 16))
      if (k.startsWith("#")) return String.fromCodePoint(Number.parseInt(k.slice(1), 10))
      return ENTITIES[k] ?? m
    })
    .trim()
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag))) {
    const name = m[1]?.toLowerCase()
    if (name) out[name] = decode(m[3] ?? m[4] ?? m[5] ?? "")
  }
  return out
}

export function parseOg(html: string, baseUrl: URL): OgData {
  const head = html.slice(0, 500_000)
  const meta = new Map<string, string>()
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0])
    const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase()
    if (key && a.content && !meta.has(key)) meta.set(key, a.content)
  }
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1]

  const abs = (u?: string) => {
    if (!u) return undefined
    try {
      const url = new URL(u, baseUrl)
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined
    } catch {
      return undefined
    }
  }

  return {
    title: meta.get("og:title") ?? meta.get("twitter:title") ?? (titleTag ? decode(titleTag) : undefined),
    image: abs(
      meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("og:image:url") ?? meta.get("twitter:image") ?? meta.get("twitter:image:src"),
    ),
    video: abs(meta.get("og:video:secure_url") ?? meta.get("og:video") ?? meta.get("og:video:url")),
    siteName: meta.get("og:site_name"),
    description: meta.get("og:description") ?? meta.get("description"),
  }
}
