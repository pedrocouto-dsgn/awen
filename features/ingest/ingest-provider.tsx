"use client"

import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState } from "react"

import { useOptionalAnalysis } from "@/features/analysis/analysis-provider"
import { LIMITS, mediaTypeForMime } from "@/lib/media/limits"
import type { CreateUploadResponse, DuplicateMatch, LinkResponse } from "@/lib/validation/ingest"

import { probeImage } from "./probe/image"
import type { ProbeResult } from "./probe/types"
import { probeVideo } from "./probe/video"
import { apiJson, putToR2 } from "./upload"

export type IngestStatus = "queued" | "preparing" | "uploading" | "finalizing" | "resolving" | "done" | "link-only" | "error"

export type IngestItem = {
  id: string
  kind: "file" | "link"
  label: string
  status: IngestStatus
  progress: number
  error?: string
  previewUrl?: string
  referenceId?: string
  duplicates: DuplicateMatch[]
  /** Kept so failed items can be retried. */
  file?: File
  url?: string
  attachTo?: string
}

export const FINISHED = new Set<IngestStatus>(["done", "error", "link-only"])

type Action =
  | { type: "add"; item: IngestItem }
  | { type: "update"; id: string; patch: Partial<IngestItem> }
  | { type: "remove"; id: string }
  | { type: "clearFinished" }

function reducer(state: IngestItem[], action: Action): IngestItem[] {
  switch (action.type) {
    case "add":
      return [...state, action.item]
    case "update":
      return state.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i))
    case "remove":
      return state.filter((i) => i.id !== action.id)
    case "clearFinished":
      return state.filter((i) => !FINISHED.has(i.status))
  }
}

type IngestContextValue = {
  items: IngestItem[]
  addFiles: (files: File[] | FileList, options?: { attachTo?: string }) => void
  addLink: (url: string) => void
  retry: (id: string) => void
  remove: (id: string) => void
  clearFinished: () => void
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
}

const IngestContext = createContext<IngestContextValue | null>(null)

const CONCURRENCY = 2

export function IngestProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const analysis = useOptionalAnalysis()
  const [items, dispatch] = useReducer(reducer, [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const queue = useRef<IngestItem[]>([])
  const running = useRef(0)

  const update = useCallback((id: string, patch: Partial<IngestItem>) => dispatch({ type: "update", id, patch }), [])

  const processFile = useCallback(
    async (item: IngestItem) => {
      const file = item.file!
      const mediaType = mediaTypeForMime(file.type)
      if (!mediaType) throw new Error("Formato não suportado. Use JPG, PNG, WebP, GIF, AVIF, MP4, MOV ou WebM.")
      const max = mediaType === "image" ? LIMITS.imageBytes : LIMITS.videoBytes
      if (file.size > max) throw new Error(`Arquivo grande demais (máx. ${Math.round(max / 1024 / 1024)} MB).`)

      update(item.id, { status: "preparing", progress: 0 })
      const probe: ProbeResult = mediaType === "image" ? await probeImage(file) : await probeVideo(file)

      const created = await apiJson<CreateUploadResponse>("/api/references", {
        method: "POST",
        body: JSON.stringify({
          attachTo: item.attachTo,
          file: { type: mediaType, name: file.name, mimeType: file.type, size: file.size },
          tech: {
            width: probe.width,
            height: probe.height,
            duration: probe.duration,
            fps: probe.fps,
            palette: probe.palette,
            phash: probe.phash,
          },
          thumb: { size: probe.thumb.size },
          frames: probe.frames.map((f) => ({ size: f.size })),
        }),
      })
      update(item.id, { referenceId: created.referenceId, duplicates: created.duplicates, status: "uploading" })

      try {
        const total = file.size + probe.thumb.size + probe.frames.reduce((s, f) => s + f.size, 0)
        const loaded = new Map<string, number>()
        const report = (key: string) => (n: number) => {
          loaded.set(key, n)
          const sum = [...loaded.values()].reduce((s, v) => s + v, 0)
          update(item.id, { progress: Math.min(99, Math.round((sum / total) * 100)) })
        }
        await Promise.all([
          putToR2(created.thumb.url, probe.thumb, "image/jpeg", report("thumb")),
          ...probe.frames.map((f, i) => putToR2(created.frames[i]!.url, f, "image/jpeg", report(`f${i}`))),
        ])
        await putToR2(created.original.url, file, file.type, report("original"))

        update(item.id, { status: "finalizing", progress: 100 })
        await apiJson(`/api/references/${created.referenceId}/finalize`, { method: "POST" })
      } catch (error) {
        // Do not leave half-uploaded new references behind.
        if (!item.attachTo) {
          await fetch(`/api/references/${created.referenceId}`, { method: "DELETE" }).catch(() => undefined)
          update(item.id, { referenceId: undefined })
        }
        throw error
      }
      update(item.id, { status: "done", file: undefined })
    },
    [update],
  )

  const processLink = useCallback(
    async (item: IngestItem) => {
      update(item.id, { status: "resolving" })
      const res = await apiJson<LinkResponse>("/api/references/link", {
        method: "POST",
        body: JSON.stringify({ url: item.url }),
      })
      update(item.id, {
        referenceId: res.referenceId,
        label: res.title ?? item.label,
        duplicates: res.duplicates,
        status: res.hasMedia ? "done" : "link-only",
      })
    },
    [update],
  )

  const pump = useCallback(() => {
    const run = () => {
      while (running.current < CONCURRENCY && queue.current.length > 0) {
        const item = queue.current.shift()!
        running.current += 1
        const work = item.kind === "file" ? processFile(item) : processLink(item)
        void work
          .catch((error: unknown) => {
            update(item.id, {
              status: "error",
              error: error instanceof Error ? error.message : "Algo deu errado.",
            })
          })
          .finally(() => {
            running.current -= 1
            router.refresh()
            analysis?.kick()
            run()
          })
      }
    }
    run()
  }, [analysis, processFile, processLink, router, update])

  const enqueue = useCallback(
    (item: IngestItem) => {
      dispatch({ type: "add", item })
      queue.current.push(item)
      pump()
    },
    [pump],
  )

  const addFiles = useCallback(
    (files: File[] | FileList, options?: { attachTo?: string }) => {
      for (const raw of Array.from(files)) {
        const file = renamePasted(raw)
        enqueue({
          id: crypto.randomUUID(),
          kind: "file",
          label: file.name,
          status: "queued",
          progress: 0,
          duplicates: [],
          file,
          attachTo: options?.attachTo,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        })
      }
    },
    [enqueue],
  )

  const addLink = useCallback(
    (url: string) => {
      const trimmed = url.trim()
      if (!trimmed) return
      enqueue({
        id: crypto.randomUUID(),
        kind: "link",
        label: trimmed,
        status: "queued",
        progress: 0,
        duplicates: [],
        url: trimmed,
      })
    },
    [enqueue],
  )

  const retry = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id)
      if (!item || item.status !== "error") return
      const reset = { ...item, status: "queued" as const, error: undefined, progress: 0, duplicates: [] }
      update(id, reset)
      queue.current.push(reset)
      pump()
    },
    [items, pump, update],
  )

  const remove = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      queue.current = queue.current.filter((i) => i.id !== id)
      dispatch({ type: "remove", id })
    },
    [items],
  )

  const clearFinished = useCallback(() => {
    for (const i of items) if (FINISHED.has(i.status) && i.previewUrl) URL.revokeObjectURL(i.previewUrl)
    dispatch({ type: "clearFinished" })
  }, [items])

  const value = useMemo(
    () => ({ items, addFiles, addLink, retry, remove, clearFinished, dialogOpen, setDialogOpen }),
    [items, addFiles, addLink, retry, remove, clearFinished, dialogOpen],
  )

  return <IngestContext.Provider value={value}>{children}</IngestContext.Provider>
}

export function useIngest(): IngestContextValue {
  const ctx = useContext(IngestContext)
  if (!ctx) throw new Error("useIngest must be used inside <IngestProvider>")
  return ctx
}

/** Clipboard images arrive as "image.png": give them a readable, unique name. */
function renamePasted(file: File): File {
  if (!/^image\.(png|jpe?g|gif|webp)$/i.test(file.name)) return file
  const stamp = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }).replace(/[/:]/g, "-")
  const ext = file.name.split(".").pop() ?? "png"
  return new File([file], `Colado ${stamp}.${ext}`, { type: file.type, lastModified: file.lastModified })
}
