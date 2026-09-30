"use client"

import { Loader2Icon, RotateCcwIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { cropSquare, loadImage } from "@/lib/media/client-image"

/** Size of the editing viewport, in CSS pixels. The circle fills it. */
const VIEW = 288
const MAX_ZOOM = 4
/** Real sizes of the avatar in the app: settings page and sidebar. */
const PREVIEWS = [80, 36]

type Crop = { zoom: number; x: number; y: number }

/**
 * Circular photo editor: drag to position, slider / wheel / keys to zoom.
 * The result is cropped in the browser to a 512px square, so only a small file
 * is uploaded.
 */
export function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  /** The picked file; the dialog is open while it is set. */
  file: File | null
  onCancel: () => void
  onConfirm: (blob: Blob) => Promise<void>
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const drag = useRef<{ pointerId: number; startX: number; startY: number; from: Crop } | null>(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    let cancelled = false
    loadImage(url)
      .then((image) => {
        if (cancelled) return
        setSrc(url)
        setImg(image)
        setError(null)
        setCrop(centered(image, 1))
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
      setImg(null)
      setSrc(null)
    }
  }, [file])

  const base = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1
  const scale = base * crop.zoom
  const width = img ? img.naturalWidth * scale : VIEW
  const height = img ? img.naturalHeight * scale : VIEW

  function clamp(next: Crop): Crop {
    if (!img) return next
    const s = base * next.zoom
    const w = img.naturalWidth * s
    const h = img.naturalHeight * s
    return {
      zoom: next.zoom,
      x: Math.min(0, Math.max(VIEW - w, next.x)),
      y: Math.min(0, Math.max(VIEW - h, next.y)),
    }
  }

  /** Zooms around the centre of the circle, so the framed point stays put. */
  function zoomTo(zoom: number) {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom))
    setCrop((c) => {
      const ratio = z / c.zoom
      return clamp({ zoom: z, x: VIEW / 2 - (VIEW / 2 - c.x) * ratio, y: VIEW / 2 - (VIEW / 2 - c.y) * ratio })
    })
  }

  async function confirm() {
    if (!img) return
    setSaving(true)
    try {
      const blob = await cropSquare(img, { x: -crop.x / scale, y: -crop.y / scale, size: VIEW / scale })
      await onConfirm(blob)
    } finally {
      setSaving(false)
    }
  }

  const imageStyle = (factor: number): React.CSSProperties => ({
    width: width * factor,
    height: height * factor,
    transform: `translate(${crop.x * factor}px, ${crop.y * factor}px)`,
  })

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
          <DialogDescription>Arraste para posicionar e use o zoom para enquadrar dentro do círculo.</DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div
              role="application"
              aria-label="Área de enquadramento. Arraste ou use as setas para mover, + e − para o zoom."
              tabIndex={0}
              className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-2xl bg-media select-none active:cursor-grabbing"
              style={{ width: VIEW, height: VIEW }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, from: crop }
              }}
              onPointerMove={(e) => {
                const d = drag.current
                if (!d || d.pointerId !== e.pointerId) return
                setCrop(clamp({ zoom: d.from.zoom, x: d.from.x + e.clientX - d.startX, y: d.from.y + e.clientY - d.startY }))
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onWheel={(e) => zoomTo(crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 20 : 5
                const moves: Record<string, [number, number]> = {
                  ArrowLeft: [step, 0],
                  ArrowRight: [-step, 0],
                  ArrowUp: [0, step],
                  ArrowDown: [0, -step],
                }
                const move = moves[e.key]
                if (move) {
                  e.preventDefault()
                  setCrop((c) => clamp({ zoom: c.zoom, x: c.x + move[0], y: c.y + move[1] }))
                } else if (e.key === "+" || e.key === "=") {
                  e.preventDefault()
                  zoomTo(crop.zoom + 0.1)
                } else if (e.key === "-") {
                  e.preventDefault()
                  zoomTo(crop.zoom - 0.1)
                }
              }}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL being edited
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
                  style={imageStyle(1)}
                />
              ) : (
                <Loader2Icon className="absolute inset-0 m-auto size-6 animate-spin text-media-foreground" aria-hidden />
              )}
              {/* Everything outside the circle is dimmed: that is what the avatar will show. */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_var(--overlay)] ring-2 ring-scrim-foreground/70"
                aria-hidden
              />
            </div>

            <div className="flex w-full items-center gap-3">
              <button
                type="button"
                onClick={() => zoomTo(crop.zoom - 0.25)}
                aria-label="Diminuir"
                className="rounded-lg p-1 text-muted-foreground hover:bg-glass-hover hover:text-foreground"
              >
                <ZoomOutIcon className="size-4" />
              </button>
              <Slider
                value={[crop.zoom]}
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                onValueChange={(v) => zoomTo(v[0] ?? 1)}
                aria-label="Zoom"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => zoomTo(crop.zoom + 0.25)}
                aria-label="Aumentar"
                className="rounded-lg p-1 text-muted-foreground hover:bg-glass-hover hover:text-foreground"
              >
                <ZoomInIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => img && setCrop(centered(img, 1))}
                aria-label="Recentralizar"
                title="Recentralizar"
                className="rounded-lg p-1 text-muted-foreground hover:bg-glass-hover hover:text-foreground"
              >
                <RotateCcwIcon className="size-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 self-start">
              <span className="text-xs text-muted-foreground">Prévia</span>
              {PREVIEWS.map((size) => (
                <span
                  key={size}
                  className="relative shrink-0 overflow-hidden rounded-full bg-media ring-1 ring-glass-border"
                  style={{ width: size, height: size }}
                  aria-hidden
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL being edited
                    <img
                      src={src}
                      alt=""
                      className="absolute top-0 left-0 max-w-none origin-top-left"
                      style={imageStyle(size / VIEW)}
                    />
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()} disabled={!img || saving}>
            {saving ? <Loader2Icon className="animate-spin" /> : null} Salvar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function centered(img: HTMLImageElement, zoom: number): Crop {
  const s = Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) * zoom
  return { zoom, x: (VIEW - img.naturalWidth * s) / 2, y: (VIEW - img.naturalHeight * s) / 2 }
}
