"use client"

import {
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
  ScanIcon,
  TextIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  BOARD_WIDTH,
  boardHeight,
  exportHeight,
  CAPTION_HEIGHT,
  layout,
  MIN_ITEM_SIDE,
  readingOrder,
  snap,
  type BoardBox,
  type BoardItem,
  type LayoutKind,
} from "@/lib/board/layout"
import { cn } from "@/lib/utils"

import {
  BACKGROUNDS,
  boardPdf,
  boardPng,
  boardZip,
  downloadBlob,
  fetchBoardMedia,
  renderBoard,
  slug,
  type BoardBackground,
} from "./export"

type Props = {
  project: { id: string; name: string }
  initialItems: BoardItem[]
  placedNow: string[]
}

type Drag = {
  id: string
  mode: "move" | "resize"
  startX: number
  startY: number
  origin: BoardBox
  moved: boolean
}

const SAVE_DELAY_MS = 700
const SIDE_GUTTER = 24
/** Free space below the content in the editor, to drag items further down. */
const EDIT_ROOM = 320
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4

const LAYOUTS: { kind: LayoutKind; label: string }[] = [
  { kind: "columns", label: "Colunas (masonry)" },
  { kind: "rows", label: "Linhas" },
  { kind: "grid", label: "Grade" },
]

const PREF_EVENT = "awen:board-pref"

function subscribePref(onChange: () => void) {
  window.addEventListener(PREF_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(PREF_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** Per-browser preference in localStorage (a convenience: falls back silently when storage is unavailable). */
function usePref<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribePref,
    () => {
      try {
        const v = localStorage.getItem(key)
        return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
      } catch {
        return fallback
      }
    },
    () => fallback,
  )
  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next)
      } catch {
        // Not persisted; nothing else to do.
      }
      window.dispatchEvent(new Event(PREF_EVENT))
    },
    [key],
  )
  return [value, set]
}

const BACKGROUND_KEYS = ["dark", "light"] as const
const DENSITIES = ["2", "3", "4", "5", "6"] as const

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || Boolean(target.closest("[role=menu]")))
  )
}

export function BoardEditor({ project, initialItems, placedNow }: Props) {
  const [items, setItems] = useState(initialItems)
  const [selected, setSelected] = useState<string | null>(null)
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [viewport, setViewport] = useState<number | null>(null)
  const [background, setBackground] = usePref<BoardBackground>(`awen:board-bg:${project.id}`, BACKGROUND_KEYS, "dark")
  const [density, setDensity] = usePref("awen:board-density", DENSITIES, "4")
  const [saveState, setSaveState] = useState<"saved" | "pending" | "saving" | "error">("saved")
  const [exporting, setExporting] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const dirty = useRef(new Set<string>(placedNow))
  // Latest items for event handlers and the save payload.
  const itemsRef = useRef(items)
  useLayoutEffect(() => {
    itemsRef.current = items
  }, [items])
  const [saveTick, setSaveTick] = useState(placedNow.length ? 1 : 0)

  // Fit the board to the available width; zoom multiplies that.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setViewport(entry?.contentRect.width ?? null))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fit = viewport ? Math.max(0.1, (viewport - SIDE_GUTTER * 2) / BOARD_WIDTH) : 0.5
  const scale = fit * zoom

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * Math.exp(-e.deltaY * 0.01))))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const markDirty = useCallback((ids: Iterable<string>) => {
    for (const id of ids) dirty.current.add(id)
    setSaveState("pending")
    setSaveTick((t) => t + 1)
  }, [])

  const flush = useCallback(
    async (keepalive = false) => {
      if (dirty.current.size === 0) return
      const ids = [...dirty.current]
      dirty.current.clear()
      const payload = itemsRef.current
        .filter((i) => ids.includes(i.referenceId))
        .map(({ referenceId, x, y, width, height, z, caption }) => ({ referenceId, x, y, width, height, z, caption }))
      if (!payload.length) return
      setSaveState("saving")
      try {
        const res = await fetch(`/api/projects/${project.id}/board`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload }),
          keepalive,
        })
        if (!res.ok) throw new Error()
        setSaveState(dirty.current.size ? "pending" : "saved")
      } catch {
        for (const id of ids) dirty.current.add(id)
        setSaveState("error")
      }
    },
    [project.id],
  )

  // Debounced autosave.
  useEffect(() => {
    if (!saveTick) return
    const timer = setTimeout(() => void flush(), SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [saveTick, flush])

  // Don't lose the last moves when leaving the page.
  useEffect(() => {
    const onHide = () => void flush(true)
    window.addEventListener("pagehide", onHide)
    return () => {
      window.removeEventListener("pagehide", onHide)
      void flush(true)
    }
  }, [flush])

  const update = useCallback((id: string, patch: Partial<BoardItem>) => {
    setItems((list) => list.map((i) => (i.referenceId === id ? { ...i, ...patch } : i)))
  }, [])

  const bringToFront = useCallback(
    (id: string) => {
      const list = itemsRef.current
      const top = Math.max(0, ...list.map((i) => i.z))
      const item = list.find((i) => i.referenceId === id)
      if (!item || (item.z === top && list.filter((i) => i.z === top).length === 1)) return
      update(id, { z: top + 1 })
      markDirty([id])
    },
    [markDirty, update],
  )

  function startDrag(e: React.PointerEvent, id: string, mode: Drag["mode"]) {
    if (e.button !== 0) return
    e.stopPropagation()
    const item = items.find((i) => i.referenceId === id)
    if (!item) return
    setSelected(id)
    if (editingCaption !== id) setEditingCaption(null)
    bringToFront(id)
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: { x: item.x, y: item.y, width: item.width, height: item.height },
      moved: false,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.startX) / scale
    const dy = (e.clientY - d.startY) / scale
    if (!d.moved && Math.hypot(dx, dy) * scale < 3) return
    d.moved = true
    const o = d.origin
    if (d.mode === "move") {
      update(d.id, {
        x: Math.min(BOARD_WIDTH - o.width / 2, Math.max(-o.width / 2, o.x + dx)),
        y: Math.max(0, o.y + dy),
      })
    } else {
      // Proportional by default (the image keeps its framing); Shift resizes freely to crop.
      const width = Math.max(MIN_ITEM_SIDE, o.width + dx)
      const height = e.shiftKey ? Math.max(MIN_ITEM_SIDE, o.height + dy) : width / (o.width / o.height)
      update(d.id, { width, height })
    }
  }

  function endDrag() {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    const item = itemsRef.current.find((i) => i.referenceId === d.id)
    if (!item) return
    if (d.mode === "move") update(d.id, { x: snap(item.x), y: snap(item.y) })
    else {
      const width = snap(item.width)
      update(d.id, { width, height: item.height * (width / item.width) })
    }
    markDirty([d.id])
  }

  const applyLayout = useCallback(
    (kind: LayoutKind) => {
      const before = itemsRef.current
      const ordered = readingOrder(before)
      const positions = layout(kind, ordered, Number(density))
      setItems(before.map((i) => ({ ...i, ...positions.get(i.referenceId) })))
      markDirty(before.map((i) => i.referenceId))
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
      toast("Board reorganizado.", {
        action: {
          label: "Desfazer",
          onClick: () => {
            setItems(before)
            markDirty(before.map((i) => i.referenceId))
          },
        },
      })
    },
    [density, markDirty],
  )

  const removeItem = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.referenceId === id)
      if (!item) return
      setItems((list) => list.filter((i) => i.referenceId !== id))
      setSelected(null)
      dirty.current.delete(id)
      try {
        const res = await fetch(`/api/projects/${project.id}/references`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceIds: [id] }),
        })
        if (!res.ok) throw new Error()
        toast("Removida do projeto. Continua na biblioteca.", {
          action: {
            label: "Desfazer",
            onClick: async () => {
              const res = await fetch(`/api/projects/${project.id}/references`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ referenceIds: [id] }),
              })
              if (!res.ok) return void toast.error("Não foi possível desfazer.")
              setItems((list) => [...list, item])
              markDirty([id])
            },
          },
        })
      } catch {
        setItems((list) => [...list, item])
        toast.error("Não foi possível remover do projeto.")
      }
    },
    [markDirty, project.id],
  )

  const commitCaption = useCallback(
    (id: string, value: string) => {
      const caption = value.trim().slice(0, 300) || null
      const item = itemsRef.current.find((i) => i.referenceId === id)
      setEditingCaption(null)
      if (!item || item.caption === caption) return
      update(id, { caption })
      markDirty([id])
    },
    [markDirty, update],
  )

  // Keyboard: arrows nudge (Shift = bigger steps), Enter edits the caption, Delete removes, Esc deselects.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selected || editingCaption || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const item = itemsRef.current.find((i) => i.referenceId === selected)
      if (!item) return
      const step = e.shiftKey ? 40 : 8
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const move = moves[e.key]
      if (move) {
        update(selected, { x: item.x + move[0], y: Math.max(0, item.y + move[1]) })
        markDirty([selected])
      } else if (e.key === "Enter") setEditingCaption(selected)
      else if (e.key === "Delete" || e.key === "Backspace") void removeItem(selected)
      else if (e.key === "Escape") setSelected(null)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editingCaption, markDirty, removeItem, selected, update])

  async function runExport(kind: "png" | "pdf" | "zip") {
    if (exporting || !items.length) return
    setExporting(true)
    const id = toast.loading(kind === "zip" ? "Juntando as imagens originais…" : "Gerando o moodboard…")
    try {
      await flush()
      const media = await fetchBoardMedia(project.id)
      const base = `${slug(project.name, "projeto")}-moodboard`
      if (kind === "zip") {
        downloadBlob(await boardZip(items, media), `${slug(project.name, "projeto")}-imagens.zip`)
      } else {
        const canvas = await renderBoard(items, media, background)
        downloadBlob(kind === "png" ? await boardPng(canvas) : await boardPdf(canvas), `${base}.${kind}`)
      }
      toast.success("Exportação pronta.", { id })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível exportar.", { id })
    } finally {
      setExporting(false)
    }
  }

  const height = useMemo(() => boardHeight(items), [items])
  const exportBottom = useMemo(() => exportHeight(items), [items])
  const colors = BACKGROUNDS[background]
  const ordered = useMemo(() => [...items].sort((a, b) => a.z - b.z), [items])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:px-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${project.id}`}>
            <ArrowLeftIcon /> Projeto
          </Link>
        </Button>
        <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
          {saveState === "saving" || saveState === "pending" ? (
            <>
              <Loader2Icon className="size-3 animate-spin" aria-hidden /> Salvando…
            </>
          ) : saveState === "error" ? (
            <button type="button" className="text-destructive underline-offset-4 hover:underline" onClick={() => void flush()}>
              Erro ao salvar. Tentar de novo
            </button>
          ) : (
            <>
              <CheckIcon className="size-3" aria-hidden /> Salvo
            </>
          )}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!items.length}>
                <LayoutDashboardIcon /> Organizar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {LAYOUTS.map((l) => (
                <DropdownMenuItem key={l.kind} onSelect={() => applyLayout(l.kind)}>
                  {l.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Densidade</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={density}
                onValueChange={(v) => setDensity(v as (typeof DENSITIES)[number])}
              >
                {DENSITIES.map((n) => (
                  <DropdownMenuRadioItem key={n} value={n} onSelect={(e) => e.preventDefault()}>
                    {n} por linha
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Fundo do board">
                <span className="size-3.5 rounded-full ring-1 ring-border-strong" style={{ backgroundColor: colors.fill }} aria-hidden />
                Fundo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={background}
                onValueChange={(v) => setBackground(v as BoardBackground)}
              >
                {(Object.keys(BACKGROUNDS) as BoardBackground[]).map((b) => (
                  <DropdownMenuRadioItem key={b} value={b}>
                    {BACKGROUNDS[b].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center">
            <Button variant="ghost" size="icon-sm" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z / 1.25))}>
              <MinusIcon />
            </Button>
            <button
              type="button"
              title="Ajustar à largura"
              onClick={() => setZoom(1)}
              className="w-12 text-center text-xs text-muted-foreground tabular-nums hover:text-foreground"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button variant="ghost" size="icon-sm" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.25))}>
              <PlusIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Ajustar à largura" onClick={() => setZoom(1)}>
              <ScanIcon />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="accent" size="sm" disabled={!items.length || exporting}>
                {exporting ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />} Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onSelect={() => void runExport("png")}>Board inteiro · PNG</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void runExport("pdf")}>Board inteiro · PDF</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void runExport("zip")}>Imagens separadas, originais · ZIP</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto px-6 pb-10"
        onPointerDown={() => {
          setSelected(null)
          setEditingCaption(null)
        }}
      >
        {items.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            Este projeto ainda não tem referências. Adicione pela biblioteca ou pela revisão (tecla P com o projeto ativo).
          </p>
        ) : (
          <div
            className="relative mx-auto rounded-xl shadow-overlay"
            style={{ width: BOARD_WIDTH * scale, height: (height + EDIT_ROOM) * scale, backgroundColor: colors.fill }}
          >
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{ width: BOARD_WIDTH, height: height + EDIT_ROOM, transform: `scale(${scale})` }}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {/* The export ends at this line: below it is only room to work in. */}
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed opacity-30"
                style={{ top: exportBottom, borderColor: colors.caption, borderTopWidth: 1 / scale }}
                aria-hidden
              />
              {ordered.map((item) => (
                <BoardTile
                  key={item.referenceId}
                  item={item}
                  scale={scale}
                  captionColor={colors.caption}
                  selected={selected === item.referenceId}
                  editingCaption={editingCaption === item.referenceId}
                  onPointerDown={(e) => startDrag(e, item.referenceId, "move")}
                  onResizeStart={(e) => startDrag(e, item.referenceId, "resize")}
                  onEditCaption={() => setEditingCaption(item.referenceId)}
                  onCommitCaption={(v) => commitCaption(item.referenceId, v)}
                  onCancelCaption={() => setEditingCaption(null)}
                  onRemove={() => void removeItem(item.referenceId)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type TileProps = {
  item: BoardItem
  scale: number
  captionColor: string
  selected: boolean
  editingCaption: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onResizeStart: (e: React.PointerEvent) => void
  onEditCaption: () => void
  onCommitCaption: (value: string) => void
  onCancelCaption: () => void
  onRemove: () => void
}

function BoardTile({
  item,
  scale,
  captionColor,
  selected,
  editingCaption,
  onPointerDown,
  onResizeStart,
  onEditCaption,
  onCommitCaption,
  onCancelCaption,
  onRemove,
}: TileProps) {
  const inv = 1 / scale
  return (
    <div
      className="absolute touch-none select-none"
      style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.z }}
    >
      <div
        role="button"
        tabIndex={-1}
        aria-label={item.title ?? "Referência"}
        aria-pressed={selected}
        onPointerDown={onPointerDown}
        onDoubleClick={onEditCaption}
        className="size-full cursor-grab overflow-hidden active:cursor-grabbing"
        style={{
          backgroundColor: item.color ?? "#3A3A3A",
          outline: selected ? `${2 * inv}px solid var(--ring)` : undefined,
          outlineOffset: selected ? 2 * inv : undefined,
        }}
      >
        {item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
          <img src={item.thumbUrl} alt={item.title ?? ""} draggable={false} className="pointer-events-none size-full object-cover" />
        ) : null}
      </div>

      {editingCaption ? (
        <input
          autoFocus
          defaultValue={item.caption ?? ""}
          maxLength={300}
          placeholder="Legenda"
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => onCommitCaption(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitCaption(e.currentTarget.value)
            else if (e.key === "Escape") onCancelCaption()
          }}
          className="absolute left-0 w-full rounded-sm border-0 bg-glass-hover px-1 outline-none"
          style={{ top: item.height + 4, height: CAPTION_HEIGHT - 8, fontSize: 14, color: captionColor }}
        />
      ) : item.caption ? (
        <p
          onDoubleClick={onEditCaption}
          className="absolute left-0 w-full truncate"
          style={{ top: item.height + (CAPTION_HEIGHT - 14) / 2 - 2, fontSize: 14, lineHeight: "18px", color: captionColor }}
        >
          {item.caption}
        </p>
      ) : null}

      {selected ? (
        <>
          <span
            role="presentation"
            onPointerDown={onResizeStart}
            title="Redimensionar (Shift: livre, para recortar)"
            className="absolute cursor-nwse-resize rounded-full border-2 border-white bg-primary shadow"
            style={{ width: 14 * inv, height: 14 * inv, right: -7 * inv, bottom: -7 * inv, borderWidth: 2 * inv }}
          />
          <div
            className="absolute right-0 flex origin-bottom-right gap-1 pb-2"
            style={{ bottom: "100%", transform: `scale(${inv})` }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button variant="outline" size="xs" className="glass-strong" onClick={onEditCaption}>
              <TextIcon /> Legenda
            </Button>
            <Button variant="outline" size="xs" className="glass-strong" asChild>
              <Link href={`/library/${item.referenceId}`}>
                <ExternalLinkIcon /> Abrir
              </Link>
            </Button>
            <Button variant="outline" size="xs" className={cn("glass-strong text-destructive")} onClick={onRemove}>
              <Trash2Icon /> Remover
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
