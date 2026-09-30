import "server-only"

import sharp, { type ResizeOptions } from "sharp"

/**
 * Profile and artist photos are cropped or downscaled in the browser first
 * (lib/media/client-image.ts), so what reaches the server is small.
 */
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024

export type PhotoPreset = "avatar" | "banner"

const PRESETS: Record<PhotoPreset, ResizeOptions> = {
  avatar: { width: 512, height: 512, fit: "cover" },
  banner: { width: 2000, height: 1200, fit: "inside", withoutEnlargement: true },
}

/** Normalizes an uploaded photo: EXIF rotation, resize, WebP, metadata stripped. */
export async function toWebpPhoto(bytes: Uint8Array, preset: PhotoPreset): Promise<Uint8Array> {
  const out = await sharp(bytes, { failOn: "error", limitInputPixels: 80_000_000 })
    .rotate()
    .resize(PRESETS[preset])
    .webp({ quality: 82 })
    .toBuffer()
  return new Uint8Array(out)
}

/** Reads the "file" field of a multipart request, or returns an error message in Portuguese. */
export async function readPhoto(request: Request): Promise<{ bytes: Uint8Array } | { error: string }> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return { error: "Não foi possível receber a imagem. Tente uma foto menor." }
  }
  const file = form.get("file")
  if (!(file instanceof File)) return { error: "Nenhuma imagem enviada." }
  if (!file.type.startsWith("image/")) return { error: "O arquivo precisa ser uma imagem." }
  if (file.size > PHOTO_MAX_BYTES) return { error: "A imagem precisa ter até 8 MB." }
  return { bytes: new Uint8Array(await file.arrayBuffer()) }
}
