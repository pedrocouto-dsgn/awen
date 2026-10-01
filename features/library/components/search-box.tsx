"use client"

import { ImageIcon, ImageUpIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { LOCAL_DROP_ATTR, REFERENCE_DRAG_TYPE } from "@/lib/library/drag"
import type { VisualSearch } from "@/lib/library/search"
import { downscaleImage } from "@/lib/media/client-image"
import { cn } from "@/lib/utils"

type Props = {
  query: string
  onQueryChange: (value: string) => void
  visual: VisualSearch | null
  /** Search by image: a reference ("parecidas") or an uploaded image (search id). */
  onVisual: (search: { parecida: string } | { imagem: string } | null) => void
}

/**
 * The library search box. Text is searched by meaning; dropping an image (a file,
 * or a card from the grid) or choosing one searches by similar images instead.
 */
export function SearchBox({ query, onQueryChange, visual, onVisual }: Props) {
  const [over, setOver] = useState(false)
  const [cardDragging, setCardDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // While a card is being dragged anywhere, invite dropping it here.
  useEffect(() => {
    const start = (e: DragEvent) => setCardDragging(Boolean(e.dataTransfer?.types.includes(REFERENCE_DRAG_TYPE)))
    const end = () => {
      setCardDragging(false)
      setOver(false)
    }
    window.addEventListener("dragstart", start)
    window.addEventListener("dragend", end)
    window.addEventListener("drop", end)
    return () => {
      window.removeEventListener("dragstart", start)
      window.removeEventListener("dragend", end)
      window.removeEventListener("drop", end)
    }
  }, [])

  async function searchByFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Arraste uma imagem para buscar parecidas.")
      return
    }
    setUploading(true)
    try {
      const body = new FormData()
      body.set("file", await downscaleImage(file, 1600))
      const res = await fetch("/api/search/image", { method: "POST", body })
      const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null
      if (!res.ok || !data?.id) throw new Error(data?.error ?? "Não foi possível buscar por esta imagem.")
      onVisual({ imagem: data.id })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível buscar por esta imagem.")
    } finally {
      setUploading(false)
    }
  }

  const accepts = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(REFERENCE_DRAG_TYPE) || e.dataTransfer.types.includes("Files")

  return (
    <div
      {...{ [LOCAL_DROP_ATTR]: "" }}
      className={cn(
        "relative max-w-md flex-1 rounded-input transition-shadow",
        (over || cardDragging) && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      onDragOver={(e) => {
        if (!accepts(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        if (!accepts(e)) return
        // Handled here: keep the app-wide drop zone from adding the file to the library.
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        setCardDragging(false)
        const id = e.dataTransfer.getData(REFERENCE_DRAG_TYPE)
        if (id) {
          onVisual({ parecida: id })
          return
        }
        const file = e.dataTransfer.files[0]
        if (file) void searchByFile(file)
      }}
    >
      {visual ? (
        <VisualChip visual={visual} onClear={() => onVisual(null)} />
      ) : (
        <>
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={
              over || cardDragging ? "Solte para ver as parecidas" : "Descreva o que procura ou arraste uma imagem"
            }
            aria-label="Buscar"
            className="h-11 bg-card pr-11 pl-10"
          />
        </>
      )}

      {visual ? null : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Buscar por imagem"
          title="Buscar por imagem"
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none"
        >
          {uploading ? <Loader2Icon className="size-4 animate-spin" /> : <ImageUpIcon className="size-4" />}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) void searchByFile(file)
        }}
      />
    </div>
  )
}

function VisualChip({ visual, onClear }: { visual: VisualSearch; onClear: () => void }) {
  const thumb = visual.kind === "similar" ? visual.thumbUrl : visual.previewUrl
  const label =
    visual.kind === "similar" ? `Parecidas com “${visual.title ?? "referência sem título"}”` : "Parecidas com a imagem enviada"

  return (
    <div className="flex h-11 items-center gap-2.5 rounded-input border border-ring bg-card pr-1.5 pl-1.5">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-media">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned URL or data URL
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Limpar busca por imagem"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}
