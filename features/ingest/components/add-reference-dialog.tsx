"use client"

import { LinkIcon, PlusIcon, UploadIcon } from "lucide-react"
import { useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from "@/lib/media/limits"
import { cn } from "@/lib/utils"

import { useIngest } from "../ingest-provider"

export const ACCEPT = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",")

export function AddReferenceDialog() {
  const { addFiles, addLink, dialogOpen, setDialogOpen } = useIngest()
  const [url, setUrl] = useState("")
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const linkId = useId()

  function submitLink(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    addLink(url)
    setUrl("")
    setDialogOpen(false)
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon /> <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar referência</DialogTitle>
          <DialogDescription>
            Arraste arquivos, cole uma imagem (⌘V / Ctrl+V) em qualquer tela, ou cole um link.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOver(false)
            if (e.dataTransfer.files.length > 0) {
              addFiles(e.dataTransfer.files)
              setDialogOpen(false)
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
            "text-muted-foreground hover:border-ring hover:text-foreground focus-visible:outline-2",
            over && "border-ring bg-accent text-foreground",
          )}
        >
          <UploadIcon className="size-6" aria-hidden />
          <span className="text-sm font-medium">Escolher ou soltar arquivos</span>
          <span className="text-xs">Imagens (JPG, PNG, WebP, GIF, AVIF) e vídeos (MP4, MOV, WebM)</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(e.target.files)
              setDialogOpen(false)
            }
            e.target.value = ""
          }}
        />

        <form onSubmit={submitLink} className="flex flex-col gap-2">
          <Label htmlFor={linkId}>Link</Label>
          <div className="flex gap-2">
            <Input
              id={linkId}
              type="url"
              inputMode="url"
              placeholder="YouTube, Vimeo, Pinterest, Instagram ou qualquer página"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button type="submit" variant="secondary" disabled={!url.trim()}>
              <LinkIcon /> Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
