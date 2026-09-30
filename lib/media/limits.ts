// Upload limits (per file). Shared by client validation and server checks.

export const MB = 1024 * 1024

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const

export const LIMITS = {
  imageBytes: 50 * MB,
  videoBytes: 300 * MB,
  thumbBytes: 5 * MB,
  frameBytes: 5 * MB,
  maxFrames: 3,
  thumbMaxSide: 1280,
} as const

export type ImageMime = (typeof IMAGE_MIME_TYPES)[number]
export type VideoMime = (typeof VIDEO_MIME_TYPES)[number]

export function mediaTypeForMime(mime: string): "image" | "video" | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return "image"
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mime)) return "video"
  return null
}

export function aspectRatio(width?: number | null, height?: number | null): number | null {
  if (!width || !height) return null
  return Math.round((width / height) * 10000) / 10000
}
