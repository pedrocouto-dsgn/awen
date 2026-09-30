// Browser canvas helpers for probing media.

export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas 2D indisponível neste navegador.")
  return { canvas, ctx }
}

export function fitInside(width: number, height: number, maxSide: number): [number, number] {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))]
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.84): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar JPEG."))), "image/jpeg", quality)
  })
}

/** Draws a source into a new canvas of the given size and returns its RGBA pixels. */
export function drawPixels(source: CanvasImageSource, width: number, height: number): ImageData {
  const { ctx } = makeCanvas(width, height)
  ctx.drawImage(source, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

/** JPEG thumbnail with a white background (for transparent PNG/GIF). */
export async function jpegThumb(source: CanvasImageSource, width: number, height: number, maxSide: number) {
  const [w, h] = fitInside(width, height, maxSide)
  const { canvas, ctx } = makeCanvas(w, h)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, w, h)
  return canvasToJpeg(canvas)
}
