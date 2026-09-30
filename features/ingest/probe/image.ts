import { LIMITS } from "@/lib/media/limits"
import { extractPalette } from "@/lib/palette"
import { PHASH_SIZE, phashFromRgba32 } from "@/lib/phash"

import { drawPixels, fitInside, jpegThumb } from "./canvas"
import type { ProbeResult } from "./types"

export async function probeImage(file: Blob): Promise<ProbeResult> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    throw new Error("Não foi possível ler esta imagem neste navegador.")
  }
  try {
    const { width, height } = bitmap
    const [pw, ph] = fitInside(width, height, 160)
    const small = drawPixels(bitmap, pw, ph)
    const tiny = drawPixels(bitmap, PHASH_SIZE, PHASH_SIZE)
    const thumb = await jpegThumb(bitmap, width, height, LIMITS.thumbMaxSide)
    return {
      type: "image",
      width,
      height,
      duration: null,
      fps: null,
      palette: extractPalette({ data: small.data, width: small.width, height: small.height }),
      phash: phashFromRgba32(tiny.data),
      thumb,
      frames: [],
    }
  } finally {
    bitmap.close()
  }
}
