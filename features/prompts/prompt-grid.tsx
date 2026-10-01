"use client"

import { Loader2Icon, PlayIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { PromptCard } from "@/lib/prompts/data"
import { STATUS_LABEL } from "@/lib/prompts/options"
import { cn } from "@/lib/utils"

type Props = {
  initialCards: PromptCard[]
  initialNextOffset?: number | null
  total?: number
  /** Current filter query string, used to fetch more pages. */
  query?: string
}

/** Prompt entries as a masonry of results, with the prompt text under each one. */
export function PromptGrid({ initialCards, initialNextOffset = null, total, query = "" }: Props) {
  const [cards, setCards] = useState(initialCards)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loading) return
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams(query)
      params.set("offset", String(nextOffset))
      const res = await fetch(`/api/prompts?${params}`)
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { cards: PromptCard[]; nextOffset: number | null }
      setCards((c) => [...c, ...data.cards.filter((n) => !c.some((x) => x.id === n.id))])
      setNextOffset(data.nextOffset)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [nextOffset, loading, query])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || nextOffset === null || error) return
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "800px" })
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore, nextOffset, error])

  return (
    <div className="flex flex-col gap-6">
      <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4 [&>li]:mb-4">
        {cards.map((card) => (
          <li key={card.id} className="break-inside-avoid">
            <PromptCardView card={card} />
          </li>
        ))}
      </ul>
      {nextOffset !== null ? (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 pb-8">
          {error ? (
            <Button variant="outline" size="sm" onClick={() => void loadMore()}>
              Tentar de novo
            </Button>
          ) : (
            <Loader2Icon className={cn("size-5 text-muted-foreground", loading ? "animate-spin" : "opacity-0")} aria-hidden />
          )}
          {total ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {cards.length} de {total}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const STATUS_TONE = { worked: "bg-success", partial: "bg-warning", failed: "bg-destructive" } as const

export function PromptCardView({ card }: { card: PromptCard }) {
  const ratio = Math.min(Math.max(card.result?.aspectRatio ?? 16 / 9, 0.5), 2.4)
  const meta = [card.model, card.tool].filter(Boolean).join(" · ")

  return (
    <Link
      href={`/prompts/${card.id}`}
      className="group/prompt glass flex flex-col overflow-hidden rounded-2xl transition-colors hover:border-ring"
    >
      {card.result ? (
        <div
          className="relative overflow-hidden bg-media"
          style={{ aspectRatio: String(ratio), backgroundColor: card.result.color ?? undefined }}
        >
          {card.result.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
            <img src={card.result.thumbUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
          ) : null}
          {card.result.kind === "video" ? (
            <span className="absolute top-3 left-3 flex size-6 items-center justify-center rounded-full bg-overlay/70 text-scrim-foreground backdrop-blur-sm">
              <PlayIcon className="size-3 fill-current" aria-hidden />
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 p-4">
        {card.title ? <p className="text-[13px] leading-snug font-semibold">{card.title}</p> : null}
        <p
          className={cn(
            "font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground",
            card.result ? "line-clamp-4" : "line-clamp-[10]",
          )}
        >
          {card.isTemplate ? <TemplateText text={card.excerpt} /> : card.excerpt}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {card.status ? (
            <span className="flex items-center gap-1.5" title={STATUS_LABEL[card.status]}>
              <span className={cn("size-2 rounded-full", STATUS_TONE[card.status])} aria-hidden />
              <span className="sr-only">{STATUS_LABEL[card.status]}</span>
            </span>
          ) : null}
          {meta ? <span className="truncate">{meta}</span> : null}
          <span className="ml-auto shrink-0 tabular-nums">{card.length.toLocaleString("pt-BR")} car.</span>
        </div>
      </div>
    </Link>
  )
}

/** Highlights {variables} in a template. */
export function TemplateText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[a-zA-Z][\w-]{0,39}\})/g).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-glass-hover px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}
