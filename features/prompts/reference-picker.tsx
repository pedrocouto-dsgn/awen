"use client"

import { CheckIcon, Loader2Icon, SearchIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { LibraryCard } from "@/lib/library/search"
import { cn } from "@/lib/utils"

export type PickedReference = { id: string; title: string | null; thumbUrl: string | null; type: "image" | "video" }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Already chosen: shown as selected and not returned again. */
  exclude?: string[]
  onPick: (refs: PickedReference[]) => void
}

/** Searches the library (same search as the Biblioteca) and returns the chosen references. */
export function ReferencePicker({ open, onOpenChange, title, description, exclude = [], onPick }: Props) {
  const [query, setQuery] = useState("")
  const [cards, setCards] = useState<LibraryCard[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Map<string, PickedReference>>(new Map())

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      fetch(`/api/library?${params}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
        .then((data: { cards: LibraryCard[] }) => !cancelled && setCards(data.cards))
        .catch(() => !cancelled && setCards([]))
        .finally(() => !cancelled && setLoading(false))
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query])

  function close(next: boolean) {
    if (!next) {
      setSelected(new Map())
      setQuery("")
    }
    onOpenChange(next)
  }

  function toggle(card: LibraryCard) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(card.id)) next.delete(card.id)
      else next.set(card.id, { id: card.id, title: card.title, thumbUrl: card.thumbUrl, type: card.type })
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[85svh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Descreva o que procura"
            aria-label="Buscar referências"
            className="pl-10"
          />
        </div>
        <div className="min-h-48 flex-1 overflow-y-auto">
          {loading && cards.length === 0 ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
            </div>
          ) : cards.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma referência encontrada.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {cards.map((card) => {
                const taken = exclude.includes(card.id)
                const on = taken || selected.has(card.id)
                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      disabled={taken}
                      aria-pressed={on}
                      onClick={() => toggle(card)}
                      title={card.title ?? undefined}
                      className={cn(
                        "relative block aspect-square w-full overflow-hidden rounded-lg bg-media outline-offset-2 disabled:opacity-50",
                        on && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                      )}
                    >
                      {card.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
                        <img src={card.thumbUrl} alt={card.title ?? ""} className="size-full object-cover" loading="lazy" />
                      ) : null}
                      {on ? (
                        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckIcon className="size-3" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button
            disabled={selected.size === 0}
            onClick={() => {
              onPick([...selected.values()])
              close(false)
            }}
          >
            {selected.size > 1 ? `Adicionar ${selected.size}` : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
