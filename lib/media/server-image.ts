import "server-only"

import sharp from "sharp"

import { extractPalette, type PaletteColor } from "@/lib/palette"
import { PHASH_SIZE, phashFromRgba32 } from "@/lib/phash"

import { LIMITS } from "./limits"

export type ProcessedImage = {
  width: number
  height: number
  mime: string
  palette: PaletteColor[]
  phash: string
  thumbnail: Uint8Array
}

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heif: "image/avif",
}

/** Server-side technical data for an image (link thumbnails / og:image). */
export async function processImage(bytes: Uint8Array): Promise<ProcessedImage> {
  const input = sharp(bytes, { failOn: "error", limitInputPixels: 80_000_000 })
  const meta = await input.metadata()
  const mime = meta.format ? MIME_BY_FORMAT[meta.format] : undefined
  if (!mime || !meta.width || !meta.height) throw new Error("Unsupported image")

  // Respect EXIF orientation for reported dimensions.
  const rotated = (meta.orientation ?? 1) >= 5
  const width = rotated ? meta.height : meta.width
  const height = rotated ? meta.width : meta.height

  const base = sharp(bytes, { limitInputPixels: 80_000_000 }).rotate()

  const [small, tiny, thumbnail] = await Promise.all([
    base.clone().resize(160, 160, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    base.clone().resize(PHASH_SIZE, PHASH_SIZE, { fit: "fill" }).ensureAlpha().raw().toBuffer(),
    base
      .clone()
      .resize(LIMITS.thumbMaxSide, LIMITS.thumbMaxSide, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer(),
  ])

  return {
    width,
    height,
    mime,
    palette: extractPalette({ data: small.data, width: small.info.width, height: small.info.height }),
    phash: phashFromRgba32(tiny),
    thumbnail: new Uint8Array(thumbnail),
  }
}
