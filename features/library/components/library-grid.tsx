"use client"

import { CheckIcon, Loader2Icon, PlayIcon, StarIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { REFERENCE_DRAG_TYPE } from "@/lib/library/drag"
import type { LibraryCard } from "@/lib/library/search"
import type { ActiveProject } from "@/lib/references/links"
import { cn } from "@/lib/utils"

type Props = {
  initialCards: LibraryCard[]
  initialNextOffset: number | null
  total: number
  /** Current filter query string, used to fetch more pages. */
  query: string
  /** On a project page: show "remove from project" on each card. */
  projectId?: string
  /** Elsewhere: "Salvar" on each card adds it to the active project. */
  activeProject?: ActiveProject
}

/** Pinterest proportions: narrow columns, 16px gutters (8px on phones). */
const MIN_COLUMN = 220
const GAP_WIDE = 16
const GAP_NARROW = 8

/**
 * Pinterest-style feed: true masonry where each card goes into the currently
 * shortest column (reading order runs across rows), with infinite scroll.
 */
export function LibraryGrid({ initialCards, initialNextOffset, total, query, projectId, activeProject }: Props) {
  const [cards, setCards] = useState(initialCards)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? null))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loading) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams(query)
      params.set("offset", String(nextOffset))
      const res = await fetch(`/api/library?${params}`)
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { cards: LibraryCard[]; nextOffset: number | null }
      setCards((c) => [...c, ...data.cards.filter((n) => !c.some((x) => x.id === n.id))])
      setNextOffset(data.nextOffset)
    } catch {
      setError("Não foi possível carregar mais. Tente de novo.")
    } finally {
      setLoading(false)
    }
  }, [nextOffset, loading, query])

  // Infinite scroll: fetch the next page shortly before the end comes into view.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || nextOffset === null || error) return
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "800px" })
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore, nextOffset, error])

  const gap = width !== null && width < 640 ? GAP_NARROW : GAP_WIDE
  const columnCount = width === null ? null : Math.max(2, Math.floor((width + gap) / (MIN_COLUMN + gap)))

  const columns = useMemo(() => {
    if (columnCount === null) return null
    const cols: LibraryCard[][] = Array.from({ length: columnCount }, () => [])
    const heights = new Array<number>(columnCount).fill(0)
    for (const card of cards) {
      let target = 0
      for (let i = 1; i < columnCount; i++) if (heights[i]! < heights[target]!) target = i
      cols[target]!.push(card)
      // Height in column-widths: the image plus room for the caption below it.
      heights[target]! += 1 / cardRatio(card) + (card.title ? 0.22 : 0.08)
    }
    return cols
  }, [cards, columnCount])

  const removeFromProject = projectId
    ? async (card: LibraryCard) => {
        const res = await fetch(`/api/projects/${projectId}/references`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceIds: [card.id] }),
        })
        if (res.ok) setCards((c) => c.filter((x) => x.id !== card.id))
        else toast.error("Não foi possível remover do projeto.")
      }
    : undefined

  const renderCard = (card: LibraryCard) => (
    <Pin
      key={card.id}
      card={card}
      onRemove={removeFromProject ? () => removeFromProject(card) : undefined}
      saveTo={projectId ? null : (activeProject ?? null)}
    />
  )

  return (
    <div className="flex flex-col gap-6">
      <div ref={containerRef}>
        {columns ? (
          <div className="flex items-start" style={{ gap }}>
            {columns.map((col, i) => (
              <ul key={i} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
                {col.map((card) => (
                  <li key={card.id}>{renderCard(card)}</li>
                ))}
              </ul>
            ))}
          </div>
        ) : (
          // Before the first measurement (SSR): CSS columns with the same look.
          <ul className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 [&>li]:mb-4">
            {cards.map((card) => (
              <li key={card.id} className="break-inside-avoid">
                {renderCard(card)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {nextOffset !== null ? (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 pb-8">
          {error ? (
            <>
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
              <Button variant="outline" size="sm" onClick={() => void loadMore()}>
                Tentar de novo
              </Button>
            </>
          ) : (
            <Loader2Icon className={cn("size-5 text-muted-foreground", loading ? "animate-spin" : "opacity-0")} aria-hidden />
          )}
          <p className="text-xs text-muted-foreground tabular-nums">
            {cards.length} de {total}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function cardRatio(card: LibraryCard): number {
  const r = card.width && card.height ? card.width / card.height : (card.aspectRatio ?? 1)
  // Keep extreme panoramas and strips readable in a narrow column.
  return Math.min(Math.max(r, 0.45), 2.4)
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`
}

function Pin({
  card,
  onRemove,
  saveTo,
}: {
  card: LibraryCard
  onRemove?: () => Promise<void>
  saveTo: ActiveProject
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovering, setHovering] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const meta = [card.shotType, ...card.mood.slice(0, 2)].filter(Boolean).join(" · ")

  async function save() {
    if (!saveTo || saveState !== "idle") return
    setSaveState("saving")
    try {
      const res = await fetch(`/api/projects/${saveTo.id}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceIds: [card.id] }),
      })
      if (!res.ok) throw new Error()
      setSaveState("saved")
      toast.success(`Salvo em “${saveTo.name}”.`)
    } catch {
      setSaveState("idle")
      toast.error("Não foi possível salvar no projeto.")
    }
  }

  return (
    <article className="group/pin flex flex-col">
      <div
        className="relative"
        onMouseEnter={() => {
          setHovering(true)
          void videoRef.current?.play().catch(() => undefined)
        }}
        onMouseLeave={() => {
          setHovering(false)
          const v = videoRef.current
          if (v) {
            v.pause()
            v.currentTime = 0
          }
        }}
      >
        <Link
          href={`/library/${card.id}`}
          aria-label={card.title ?? "Abrir referência"}
          // Dropped on the library search box, a card shows its similar references.
          onDragStart={(e) => e.dataTransfer.setData(REFERENCE_DRAG_TYPE, card.id)}
          className="relative block overflow-hidden rounded-2xl bg-media"
          style={{ aspectRatio: String(cardRatio(card)), backgroundColor: card.palette[0]?.hex }}
        >
          {card.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
            <img
              src={card.thumbUrl}
              alt={card.title ?? ""}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
          {card.previewUrl ? (
            <video
              ref={videoRef}
              src={hovering ? card.previewUrl : undefined}
              muted
              loop
              playsInline
              preload="none"
              aria-hidden
              className="absolute inset-0 size-full object-cover opacity-0 transition-opacity group-hover/pin:opacity-100"
            />
          ) : null}
          {/* Pinterest hover: the whole pin dims, actions float on top. */}
          <span
            className="absolute inset-0 bg-overlay/0 transition-colors group-hover/pin:bg-overlay/35 group-has-[:focus-visible]/pin:bg-overlay/35"
            aria-hidden
          />
          {card.type === "video" ? (
            <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-overlay/70 px-2 py-1 text-[11px] font-medium text-scrim-foreground backdrop-blur-sm">
              <PlayIcon className="size-2.5 fill-current" aria-hidden />
              {card.duration ? formatDuration(card.duration) : card.sourceKind === "youtube" ? "YouTube" : "Vídeo"}
            </span>
          ) : null}
          <span className="absolute inset-x-3 bottom-3 flex items-center gap-2 opacity-0 transition-opacity group-hover/pin:opacity-100">
            {card.palette.length ? (
              <span className="flex overflow-hidden rounded-full ring-1 ring-white/30" aria-hidden>
                {card.palette.slice(0, 5).map((c) => (
                  <span key={c.hex} className="size-3.5" style={{ backgroundColor: c.hex }} />
                ))}
              </span>
            ) : null}
            {card.rating ? (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-overlay/70 px-2 py-1 text-[11px] font-medium text-scrim-foreground">
                <StarIcon className="size-3 fill-current" aria-hidden /> {card.rating}
              </span>
            ) : null}
          </span>
        </Link>

        {onRemove ? (
          <button
            type="button"
            aria-label={`Remover “${card.title ?? "referência"}” do projeto`}
            onClick={() => void onRemove()}
            className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-overlay/70 text-scrim-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover/pin:opacity-100 focus-visible:opacity-100"
          >
            <XIcon className="size-4" />
          </button>
        ) : saveTo ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saveState !== "idle"}
            title={`Salvar em “${saveTo.name}” (projeto ativo)`}
            className={cn(
              "absolute top-3 right-3 flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-opacity focus-visible:opacity-100",
              saveState === "saved"
                ? "bg-overlay/80 text-scrim-foreground opacity-100"
                : "bg-primary text-primary-foreground opacity-0 hover:bg-primary-hover group-hover/pin:opacity-100",
            )}
          >
            {saveState === "saving" ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
            {saveState === "saved" ? <CheckIcon className="size-4" aria-hidden /> : null}
            {saveState === "saved" ? "Salvo" : "Salvar"}
          </button>
        ) : null}
      </div>

      {card.title || meta ? (
        <Link href={`/library/${card.id}`} tabIndex={-1} className="flex flex-col gap-0.5 px-1.5 pt-2">
          {card.title ? <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-foreground">{card.title}</p> : null}
          {meta ? <p className="truncate text-xs text-muted-foreground">{meta}</p> : null}
        </Link>
      ) : null}
    </article>
  )
}
