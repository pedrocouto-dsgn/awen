"use client"

import { UploadIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useIngest } from "../ingest-provider"

function looksLikeUrl(text: string): boolean {
  const t = text.trim()
  if (!t || /\s/.test(t) || t.length > 2048) return false
  return /^https?:\/\/\S+\.\S+/i.test(t) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*/i.test(t)
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

/** App-wide: drop files or links anywhere, and paste images or links when no field is focused. */
export function GlobalDropPaste() {
  const { addFiles, addLink, dialogOpen } = useIngest()
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)

  useEffect(() => {
    const hasPayload = (e: DragEvent) =>
      Boolean(e.dataTransfer?.types.some((t) => t === "Files" || t === "text/uri-list"))

    const onDragEnter = (e: DragEvent) => {
      if (!hasPayload(e) || dialogOpen) return
      depth.current += 1
      setDragging(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (hasPayload(e)) e.preventDefault()
    }
    const onDragLeave = () => {
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      depth.current = 0
      setDragging(false)
      if (!e.dataTransfer || dialogOpen) return
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
        return
      }
      const uri = e.dataTransfer.getData("text/uri-list").split("\n").find((l) => l && !l.startsWith("#"))
      const text = uri ?? e.dataTransfer.getData("text/plain")
      if (text && looksLikeUrl(text)) addLink(text)
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target) || !e.clipboardData) return
      const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      if (files.length > 0) {
        e.preventDefault()
        addFiles(files)
        return
      }
      const text = e.clipboardData.getData("text/plain")
      if (looksLikeUrl(text)) {
        e.preventDefault()
        addLink(text)
      }
    }

    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDrop)
    window.addEventListener("paste", onPaste)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDrop)
      window.removeEventListener("paste", onPaste)
    }
  }, [addFiles, addLink, dialogOpen])

  if (!dragging) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-overlay p-6">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ring bg-background px-10 py-8 text-center">
        <UploadIcon className="size-7 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Solte para adicionar</p>
      </div>
    </div>
  )
}
