// Browser-side image helpers for profile and artist photos. Photos are cropped or
// downscaled here so only a small file is uploaded (the proxy caps bodies at 10 MB).

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Não foi possível abrir esta imagem."))
    img.src = src
  })
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** WebP where the browser can encode it; Safari silently falls back to PNG, so use JPEG there. */
async function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  const webp = await encode(canvas, "image/webp", quality)
  const blob = webp?.type === "image/webp" ? webp : await encode(canvas, "image/jpeg", quality)
  if (!blob) throw new Error("Não foi possível gerar a imagem.")
  return blob
}

/** Draws a region of `img` (in its natural pixels) into a `size`×`size` square. */
export async function cropSquare(
  img: HTMLImageElement,
  region: { x: number; y: number; size: number },
  size = 512,
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.")
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, region.x, region.y, region.size, region.size, 0, 0, size, size)
  return canvasToBlob(canvas)
}

/** Shrinks a photo so its long edge is at most `maxEdge` pixels (banners). */
export async function downscaleImage(file: File, maxEdge = 2400): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.")
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvasToBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}
