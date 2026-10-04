// Moodboard export, entirely in the browser: R2 serves the media with CORS, so images
// can be drawn on a canvas without tainting it. No server size limits apply.

import { zipSync } from "fflate"

import type { BoardMedia } from "@/lib/board/data"
import { BOARD_WIDTH, CAPTION_HEIGHT, exportHeight, readingOrder, type BoardItem } from "@/lib/board/layout"

export type BoardBackground = "dark" | "light"

export const BACKGROUNDS: Record<BoardBackground, { fill: string; caption: string; label: string }> = {
  dark: { fill: "#111111", caption: "#B7BABB", label: "Escuro" },
  light: { fill: "#F4F6F7", caption: "#4D4D4D", label: "Claro" },
}

/** Export resolution: 2 px per board unit, unless the board is very tall. */
const EXPORT_SCALE = 2
const MAX_CANVAS_SIDE = 16_000
const CAPTION_FONT = 14

export async function fetchBoardMedia(projectId: string): Promise<Map<string, BoardMedia>> {
  const res = await fetch(`/api/projects/${projectId}/board`)
  if (!res.ok) throw new Error("Não foi possível carregar as imagens.")
  const data = (await res.json()) as { media: BoardMedia[] }
  return new Map(data.media.map((m) => [m.referenceId, m]))
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors" })
  if (!res.ok) throw new Error("Falha ao baixar uma imagem.")
  return res.blob()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function slug(s: string | null | undefined, fallback: string): string {
  const out = (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return out || fallback
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return `${text.slice(0, lo)}…`
}

/** Draws the board like the editor shows it: images cropped to their boxes (object-fit: cover), captions below. */
export async function renderBoard(
  items: BoardItem[],
  media: Map<string, BoardMedia>,
  background: BoardBackground,
): Promise<HTMLCanvasElement> {
  const height = exportHeight(items)
  const scale = Math.min(EXPORT_SCALE, MAX_CANVAS_SIDE / BOARD_WIDTH, MAX_CANVAS_SIDE / height)
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(BOARD_WIDTH * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas indisponível.")

  const colors = BACKGROUNDS[background]
  ctx.fillStyle = colors.fill
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.imageSmoothingQuality = "high"
  const fontFamily = getComputedStyle(document.body).fontFamily || "sans-serif"

  const bitmaps = await Promise.all(
    items.map(async (item) => {
      const m = media.get(item.referenceId)
      const url = m?.originalUrl ?? m?.thumbUrl
      if (!url) return null
      try {
        return await createImageBitmap(await fetchBlob(url))
      } catch {
        // Fall back to the thumbnail if the original cannot be decoded (e.g. HEIC/AVIF quirks).
        return m?.thumbUrl && m.thumbUrl !== url ? createImageBitmap(await fetchBlob(m.thumbUrl)) : null
      }
    }),
  )

  const order = [...items.keys()].sort((a, b) => items[a]!.z - items[b]!.z)
  for (const index of order) {
    const item = items[index]!
    const bitmap = bitmaps[index]
    if (bitmap) {
      // Cover crop: the largest centred source rect with the box's proportions.
      const boxRatio = item.width / item.height
      const imgRatio = bitmap.width / bitmap.height
      const sw = imgRatio > boxRatio ? bitmap.height * boxRatio : bitmap.width
      const sh = imgRatio > boxRatio ? bitmap.height : bitmap.width / boxRatio
      ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, item.x, item.y, item.width, item.height)
      bitmap.close()
    } else {
      ctx.fillStyle = item.color ?? "#3A3A3A"
      ctx.fillRect(item.x, item.y, item.width, item.height)
    }
    if (item.caption) {
      ctx.font = `400 ${CAPTION_FONT}px ${fontFamily}`
      ctx.fillStyle = colors.caption
      ctx.textBaseline = "top"
      ctx.fillText(ellipsize(ctx, item.caption, item.width), item.x, item.y + item.height + (CAPTION_HEIGHT - CAPTION_FONT) / 2)
    }
  }
  return canvas
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))), type, quality),
  )
}

export function boardPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return toBlob(canvas, "image/png")
}

/** Single-page PDF holding the board as a JPEG (DCTDecode), sized at 0.75 pt per board unit. */
export async function boardPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const jpeg = new Uint8Array(await (await toBlob(canvas, "image/jpeg", 0.92)).arrayBuffer())
  const pageW = (BOARD_WIDTH * 0.75).toFixed(2)
  const pageH = ((canvas.height / canvas.width) * BOARD_WIDTH * 0.75).toFixed(2)
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`

  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? enc.encode(chunk) : chunk
    parts.push(bytes)
    length += bytes.byteLength
  }
  const obj = (body: string) => {
    offsets.push(length)
    push(`${offsets.length} 0 obj\n${body}\nendobj\n`)
  }

  push("%PDF-1.4\n%âãÏÓ\n")
  obj("<< /Type /Catalog /Pages 2 0 R >>")
  obj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  obj(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  )
  offsets.push(length)
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`,
  )
  push(jpeg)
  push("\nendstream\nendobj\n")
  obj(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)

  const xref = length
  push(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`)
  for (const o of offsets) push(`${String(o).padStart(10, "0")} 00000 n \n`)
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: "application/pdf" })
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
}

/** Every image in its original file, numbered in reading order. Videos contribute their cover. */
export async function boardZip(items: BoardItem[], media: Map<string, BoardMedia>): Promise<Blob> {
  const ordered = readingOrder(items)
  const pad = String(ordered.length).length
  const entries = await Promise.all(
    ordered.map(async (item, i) => {
      const m = media.get(item.referenceId)
      const url = m?.originalUrl ?? m?.thumbUrl
      if (!url) return null
      const bytes = new Uint8Array(await (await fetchBlob(url)).arrayBuffer())
      const ext = m?.originalUrl ? (EXT[m.mime ?? ""] ?? "jpg") : "jpg"
      const name = `${String(i + 1).padStart(pad, "0")}-${slug(item.caption ?? item.title, "referencia")}${item.type === "video" ? "-capa" : ""}.${ext}`
      return [name, bytes] as const
    }),
  )
  // Already-compressed media: store without recompressing, in reading order.
  const files: Record<string, [Uint8Array, { level: 0 }]> = {}
  for (const entry of entries) if (entry) files[entry[0]] = [entry[1], { level: 0 }]
  return new Blob([zipSync(files) as BlobPart], { type: "application/zip" })
}
