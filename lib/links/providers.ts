// URL classification for supported providers. Pure.

export type LinkKind =
  | { provider: "youtube"; videoId: string; isShort: boolean }
  | { provider: "vimeo"; videoId: string }
  | { provider: "pinterest"; pinId: string | null }
  | { provider: "instagram" }
  | { provider: "generic" }

export function classifyUrl(raw: string): LinkKind {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { provider: "generic" }
  }
  const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase()

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0]
    if (id && /^[\w-]{11}$/.test(id)) return { provider: "youtube", videoId: id, isShort: false }
  }
  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v")
    if (v && /^[\w-]{11}$/.test(v)) return { provider: "youtube", videoId: v, isShort: false }
    const m = /^\/(shorts|embed|live|v)\/([\w-]{11})/.exec(url.pathname)
    if (m?.[2]) return { provider: "youtube", videoId: m[2], isShort: m[1] === "shorts" }
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /\/(?:video\/)?(\d{6,12})(?:\/|$)/.exec(url.pathname)
    if (m?.[1]) return { provider: "vimeo", videoId: m[1] }
  }
  if (host === "pin.it" || /(^|\.)pinterest\.[a-z.]+$/.test(host)) {
    return { provider: "pinterest", pinId: pinterestPinId(url) }
  }
  if (host === "instagram.com" || host === "instagr.am") return { provider: "instagram" }
  return { provider: "generic" }
}

export function pinterestPinId(url: URL): string | null {
  return /\/pin\/(\d{6,25})(?:\/|$)/.exec(url.pathname)?.[1] ?? null
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`
}

export function vimeoEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${videoId}`
}
