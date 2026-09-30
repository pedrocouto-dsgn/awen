import "server-only"

import { z } from "zod"

import { classifyUrl, vimeoEmbedUrl, youtubeEmbedUrl } from "./providers"
import { parseOg } from "./og"
import { safeFetch } from "./safe-fetch"

export type ResolvedLink = {
  provider: "youtube" | "vimeo" | "pinterest" | "instagram" | "generic"
  sourceKind: "youtube" | "vimeo" | "link"
  type: "image" | "video"
  url: string
  title: string | null
  /** Image to download: the media itself for image links, a thumbnail for video providers. */
  imageUrl: string | null
  /** True when imageUrl is the media itself (store as original), not just a preview. */
  imageIsMedia: boolean
  width: number | null
  height: number | null
  duration: number | null
  meta: Record<string, string | number | boolean | null>
}

const youtubeOembed = z.object({
  title: z.string().optional(),
  author_name: z.string().optional(),
  author_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
})

const vimeoOembed = z.object({
  title: z.string().optional(),
  author_name: z.string().optional(),
  author_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  video_id: z.number().optional(),
})

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await safeFetch(url, { accept: "application/json", maxBytes: 512 * 1024 })
    if (res.status !== 200) return null
    return JSON.parse(new TextDecoder().decode(res.body)) as unknown
  } catch {
    return null
  }
}

async function firstExistingImage(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD" })
      if (res.ok) return url
    } catch {
      // try next
    }
  }
  return null
}

export async function resolveLink(rawUrl: string): Promise<ResolvedLink> {
  const kind = classifyUrl(rawUrl)

  if (kind.provider === "youtube") {
    const canonical = `https://www.youtube.com/watch?v=${kind.videoId}`
    const data = youtubeOembed.safeParse(
      await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonical)}`),
    )
    const o = data.success ? data.data : {}
    const thumb = await firstExistingImage([
      `https://i.ytimg.com/vi/${kind.videoId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${kind.videoId}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${kind.videoId}/hqdefault.jpg`,
    ])
    return {
      provider: "youtube",
      sourceKind: "youtube",
      type: "video",
      url: kind.isShort ? `https://www.youtube.com/shorts/${kind.videoId}` : canonical,
      title: o.title ?? null,
      imageUrl: thumb ?? o.thumbnail_url ?? null,
      imageIsMedia: false,
      width: kind.isShort ? 1080 : 1920,
      height: kind.isShort ? 1920 : 1080,
      duration: null,
      meta: {
        provider: "youtube",
        videoId: kind.videoId,
        embedUrl: youtubeEmbedUrl(kind.videoId),
        isShort: kind.isShort,
        author: o.author_name ?? null,
        authorUrl: o.author_url ?? null,
      },
    }
  }

  if (kind.provider === "vimeo") {
    // Keep the original URL: unlisted videos carry a privacy hash (vimeo.com/<id>/<hash>).
    const canonical = rawUrl.includes("player.vimeo.com") ? `https://vimeo.com/${kind.videoId}` : rawUrl
    const data = vimeoOembed.safeParse(
      await fetchJson(`https://vimeo.com/api/oembed.json?width=1920&url=${encodeURIComponent(canonical)}`),
    )
    const o = data.success ? data.data : {}
    return {
      provider: "vimeo",
      sourceKind: "vimeo",
      type: "video",
      url: canonical,
      title: o.title ?? null,
      imageUrl: o.thumbnail_url ?? null,
      imageIsMedia: false,
      width: o.width ?? null,
      height: o.height ?? null,
      duration: o.duration ?? null,
      meta: {
        provider: "vimeo",
        videoId: kind.videoId,
        embedUrl: vimeoEmbedUrl(kind.videoId),
        author: o.author_name ?? null,
        authorUrl: o.author_url ?? null,
      },
    }
  }

  // Pinterest, Instagram and generic pages: Open Graph.
  let title: string | null = null
  let imageUrl: string | null = null
  let finalUrl = rawUrl
  let siteName: string | null = null
  try {
    const res = await safeFetch(rawUrl, { accept: "text/html,application/xhtml+xml", maxBytes: 2 * 1024 * 1024 })
    finalUrl = res.url.toString()
    if (res.contentType.startsWith("image/")) {
      // Direct image link.
      imageUrl = finalUrl
    } else if (res.status === 200 && res.contentType.includes("html")) {
      const og = parseOg(new TextDecoder().decode(res.body), res.url)
      title = og.title ?? null
      imageUrl = og.image ?? null
      siteName = og.siteName ?? null
    }
  } catch {
    // Unreachable or blocked: keep as a link-only reference.
  }

  return {
    provider: kind.provider,
    sourceKind: "link",
    type: "image",
    url: finalUrl,
    title,
    imageUrl,
    imageIsMedia: true,
    width: null,
    height: null,
    duration: null,
    meta: { provider: kind.provider, siteName, host: new URL(finalUrl).hostname },
  }
}
