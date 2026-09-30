"use client"

import { Loader2Icon, PlayIcon, StarIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { LibraryCard } from "@/lib/library/search"

type Props = {
  initialCards: LibraryCard[]
  initialNextOffset: number | null
  total: number
  /** Current filter query string, used to fetch more pages. */
  query: string
  /** On a project page: show "remove from project" on each card. */
  projectId?: string
}

export function LibraryGrid({ initialCards, initialNextOffset, total, query, projectId }: Props) {
  const [cards, setCards] = useState(initialCards)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadMore() {
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
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 [&>li]:mb-4">
        {cards.map((card) => (
          <li key={card.id} className="break-inside-avoid">
            <Card
              card={card}
              onRemove={
                projectId
                  ? async () => {
                      const res = await fetch(`/api/projects/${projectId}/references`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ referenceIds: [card.id] }),
                      })
                      if (res.ok) setCards((c) => c.filter((x) => x.id !== card.id))
                      else toast.error("Não foi possível remover do projeto.")
                    }
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
      {nextOffset !== null ? (
        <div className="flex flex-col items-center gap-2 pb-8">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loading}>
            {loading ? <Loader2Icon className="animate-spin" /> : null} Carregar mais
          </Button>
          <p className="text-xs text-muted-foreground tabular-nums">
            {cards.length} de {total}
          </p>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`
}

function Card({ card, onRemove }: { card: LibraryCard; onRemove?: () => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovering, setHovering] = useState(false)
  const ratio = card.width && card.height ? card.width / card.height : (card.aspectRatio ?? 1)
  const fallbackColor = card.palette[0]?.hex

  return (
    <div className="group relative">
    <Link
      href={`/library/${card.id}`}
      className="group relative block overflow-hidden bg-media"
      style={{ aspectRatio: String(ratio), backgroundColor: fallbackColor }}
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
      {card.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
        <img
          src={card.thumbUrl}
          alt={card.title ?? ""}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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
          className="absolute inset-0 size-full object-cover opacity-0 transition-opacity group-hover:opacity-100"
        />
      ) : null}

      {card.type === "video" ? (
        <span className="type-label absolute top-2 left-2 flex items-center gap-1 bg-overlay px-2 py-0.5 text-scrim-foreground">
          <PlayIcon className="size-2.5 fill-current" aria-hidden />
          {card.duration ? formatDuration(card.duration) : card.sourceKind === "youtube" ? "YouTube" : "Vídeo"}
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-scrim p-4 pt-10 text-scrim-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <p className="type-caption line-clamp-2 font-medium">{card.title ?? "Sem título"}</p>
        <div className="flex items-center gap-2 text-[10px] opacity-80">
          {card.shotType ? <span>{card.shotType}</span> : null}
          {card.mood.slice(0, 2).map((m) => (
            <span key={m}>· {m}</span>
          ))}
          {card.rating ? (
            <span className="ml-auto flex items-center gap-0.5">
              <StarIcon className="size-2.5 fill-current" aria-hidden /> {card.rating}
            </span>
          ) : null}
        </div>
        {card.palette.length ? (
          <div className="mt-1 flex h-1 overflow-hidden" aria-hidden>
            {card.palette.map((c) => (
              <span key={c.hex} style={{ backgroundColor: c.hex, width: `${c.pct}%` }} />
            ))}
          </div>
        ) : null}
      </div>
    </Link>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remover “${card.title ?? "referência"}” do projeto`}
          onClick={() => void onRemove()}
          className="absolute top-2 right-2 flex size-7 items-center justify-center bg-overlay text-scrim-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
