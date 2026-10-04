"use client"

import { LinkIcon, PlayIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import type { ReferenceView } from "@/lib/references/view"

import type { ReviewItem } from "../data"

/** Same proportions as the library feed. */
const MIN_COLUMN = 220
const GAP_WIDE = 16
const GAP_NARROW = 8

function thumbOf(media: ReferenceView["media"]): string | null {
  if (media.kind === "image") return media.thumb ?? media.src
  return media.poster
}

function ratioOf(item: ReviewItem): number {
  const r = item.width && item.height ? item.width / item.height : (item.aspect_ratio ?? 1)
  return Math.min(Math.max(r, 0.45), 2.4)
}

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

/**
 * Review queue as a masonry feed (oldest first, reading order across rows):
 * the whole queue at a glance, open any item to review it.
 */
export function ReviewGrid({ items, onOpen }: { items: ReviewItem[]; onOpen: (id: string) => void }) {
  const [width, setWidth] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? null))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const gap = width !== null && width < 640 ? GAP_NARROW : GAP_WIDE
  const columnCount = width === null ? null : Math.max(2, Math.floor((width + gap) / (MIN_COLUMN + gap)))

  const columns = useMemo(() => {
    if (columnCount === null) return null
    const cols: ReviewItem[][] = Array.from({ length: columnCount }, () => [])
    const heights = new Array<number>(columnCount).fill(0)
    for (const item of items) {
      let target = 0
      for (let i = 1; i < columnCount; i++) if (heights[i]! < heights[target]!) target = i
      cols[target]!.push(item)
      heights[target]! += 1 / ratioOf(item)
    }
    return cols
  }, [items, columnCount])

  return (
    <div ref={containerRef}>
      {columns ? (
        <div className="flex items-start" style={{ gap }}>
          {columns.map((col, i) => (
            <ul key={i} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
              {col.map((item) => (
                <li key={item.id}>
                  <Tile item={item} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Tile({ item, onOpen }: { item: ReviewItem; onOpen: (id: string) => void }) {
  const thumb = thumbOf(item.media)
  const meta = [item.shot_type, ...(item.mood ?? []).slice(0, 2)].filter(Boolean).join(" · ")

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-label={item.title ?? "Revisar referência"}
      className="group/pin relative block w-full overflow-hidden rounded-2xl bg-media text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ aspectRatio: String(ratioOf(item)), backgroundColor: item.palette[0]?.hex }}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
        <img
          src={thumb}
          alt={item.title ?? ""}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
          <LinkIcon className="size-5" aria-hidden />
          <span className="truncate">{hostOf(item.source_url) ?? "Sem mídia"}</span>
          <span>Sem mídia capturável</span>
        </span>
      )}
      <span
        className="absolute inset-0 bg-overlay/0 transition-colors group-hover/pin:bg-overlay/35 group-focus-visible/pin:bg-overlay/35"
        aria-hidden
      />
      {item.type === "video" ? (
        <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-overlay/70 px-2 py-1 text-[11px] font-medium text-scrim-foreground backdrop-blur-sm">
          <PlayIcon className="size-2.5 fill-current" aria-hidden /> Vídeo
        </span>
      ) : null}
      {item.title || meta ? (
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-linear-to-t from-overlay to-transparent px-3 pt-8 pb-3 opacity-0 transition-opacity group-hover/pin:opacity-100 group-focus-visible/pin:opacity-100">
          {item.title ? (
            <span className="line-clamp-2 text-[13px] leading-snug font-semibold text-scrim-foreground">{item.title}</span>
          ) : null}
          {meta ? <span className="truncate text-xs text-scrim-foreground/80">{meta}</span> : null}
        </span>
      ) : null}
    </button>
  )
}
