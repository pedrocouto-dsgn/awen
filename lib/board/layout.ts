// Moodboard geometry. Pure: shared by the editor, the auto-placement and the export.
// Positions are in board units: the board is BOARD_WIDTH wide, its height follows the content.

export const BOARD_WIDTH = 1600
export const BOARD_PADDING = 48
export const BOARD_GAP = 16
export const BOARD_MIN_HEIGHT = 900
/** Room reserved under an item for its caption. */
export const CAPTION_HEIGHT = 36
export const MIN_ITEM_SIDE = 64
export const SNAP = 8

export type BoardBox = { x: number; y: number; width: number; height: number }

export type BoardItem = BoardBox & {
  referenceId: string
  z: number
  caption: string | null
  title: string | null
  type: "image" | "video"
  /** Natural aspect ratio of the media (width / height). */
  ratio: number
  color: string | null
  thumbUrl: string | null
}

export type LayoutKind = "columns" | "rows" | "grid"

const INNER = BOARD_WIDTH - BOARD_PADDING * 2

export const snap = (v: number) => Math.round(v / SNAP) * SNAP

type Captioned = BoardBox & { caption: string | null }

/** Lowest edge of the content, captions included. */
export function contentBottom(items: Captioned[]): number {
  let bottom = 0
  for (const i of items) bottom = Math.max(bottom, i.y + i.height + (i.caption ? CAPTION_HEIGHT : 0))
  return bottom
}

/** Exported area: the content plus padding, without the editor's minimum height. */
export function exportHeight(items: Captioned[]): number {
  return Math.ceil(contentBottom(items) + BOARD_PADDING)
}

export function boardHeight(items: Captioned[]): number {
  return Math.max(BOARD_MIN_HEIGHT, Math.ceil(contentBottom(items) + BOARD_PADDING))
}

/** Reading order: top to bottom, then left to right. */
export function readingOrder<T extends BoardBox>(items: T[]): T[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x)
}

type Sized = { referenceId: string; ratio: number; caption: string | null }

/** Masonry: equal-width columns, each item into the shortest column. */
function columns(items: Sized[], count: number, top: number): Map<string, BoardBox> {
  const colWidth = (INNER - BOARD_GAP * (count - 1)) / count
  const heights = new Array<number>(count).fill(top)
  const out = new Map<string, BoardBox>()
  for (const item of items) {
    let c = 0
    for (let i = 1; i < count; i++) if (heights[i]! < heights[c]!) c = i
    const height = colWidth / item.ratio
    out.set(item.referenceId, { x: BOARD_PADDING + c * (colWidth + BOARD_GAP), y: heights[c]!, width: colWidth, height })
    heights[c]! += height + (item.caption ? CAPTION_HEIGHT : 0) + BOARD_GAP
  }
  return out
}

/** Justified rows: every row fills the width at a shared height (the last row is not stretched). */
function rows(items: Sized[], count: number, top: number): Map<string, BoardBox> {
  // Denser layouts (more "columns") get lower rows.
  const target = (INNER / count) * 0.85
  const out = new Map<string, BoardBox>()
  let y = top
  let row: Sized[] = []

  const flush = (stretch: boolean) => {
    if (!row.length) return
    const ratioSum = row.reduce((s, i) => s + i.ratio, 0)
    const gaps = BOARD_GAP * (row.length - 1)
    const height = stretch ? (INNER - gaps) / ratioSum : target
    let x = BOARD_PADDING
    for (const item of row) {
      const width = height * item.ratio
      out.set(item.referenceId, { x, y, width, height })
      x += width + BOARD_GAP
    }
    y += height + (row.some((i) => i.caption) ? CAPTION_HEIGHT : 0) + BOARD_GAP
    row = []
  }

  for (const item of items) {
    row.push(item)
    const width = row.reduce((s, i) => s + i.ratio * target, 0) + BOARD_GAP * (row.length - 1)
    if (width >= INNER) flush(true)
  }
  flush(false)
  return out
}

/** Uniform grid: square cells, each image fitted (not cropped) and centred in its cell. */
function grid(items: Sized[], count: number, top: number): Map<string, BoardBox> {
  const cell = (INNER - BOARD_GAP * (count - 1)) / count
  const out = new Map<string, BoardBox>()
  let y = top
  for (let start = 0; start < items.length; start += count) {
    const row = items.slice(start, start + count)
    row.forEach((item, i) => {
      const width = item.ratio >= 1 ? cell : cell * item.ratio
      const height = item.ratio >= 1 ? cell / item.ratio : cell
      out.set(item.referenceId, {
        x: BOARD_PADDING + i * (cell + BOARD_GAP) + (cell - width) / 2,
        y: y + (cell - height) / 2,
        width,
        height,
      })
    })
    y += cell + (row.some((i) => i.caption) ? CAPTION_HEIGHT : 0) + BOARD_GAP
  }
  return out
}

export function layout(kind: LayoutKind, items: Sized[], count: number, top = BOARD_PADDING): Map<string, BoardBox> {
  const n = Math.min(8, Math.max(1, Math.round(count)))
  return kind === "columns" ? columns(items, n, top) : kind === "rows" ? rows(items, n, top) : grid(items, n, top)
}

/** Where to put items that have never been placed: a masonry block under everything else. */
export function placeNew(placed: Captioned[], fresh: Sized[]): Map<string, BoardBox> {
  const top = placed.length ? contentBottom(placed) + BOARD_GAP * 2 : BOARD_PADDING
  return columns(fresh, 4, top)
}
