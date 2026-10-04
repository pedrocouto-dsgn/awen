"use client"

import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileVideoIcon,
  LinkIcon,
  Loader2Icon,
  RotateCcwIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { FINISHED, useIngest, type IngestItem } from "../ingest-provider"
import { ACCEPT } from "./add-reference-dialog"

const STATUS_LABEL: Record<IngestItem["status"], string> = {
  queued: "Na fila…",
  preparing: "Lendo arquivo…",
  uploading: "Enviando",
  finalizing: "Finalizando…",
  resolving: "Buscando link…",
  done: "Enviado para análise",
  "link-only": "Sem mídia capturável",
  error: "Erro",
}

/** Once everything has finished, the tray closes by itself after this long (paused on hover). */
const AUTO_CLOSE_MS = 7000

export function IngestTray() {
  const { items, clearFinished } = useIngest()
  const [collapsed, setCollapsed] = useState(false)
  const [hovering, setHovering] = useState(false)

  const active = items.filter((i) => !FINISHED.has(i.status)).length
  // Errors stay until closed by hand, so a failed upload is not lost unnoticed.
  const hasError = items.some((i) => i.status === "error")
  const autoClose = items.length > 0 && active === 0 && !hasError && !hovering

  useEffect(() => {
    if (!autoClose) return
    const timer = setTimeout(clearFinished, AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [autoClose, clearFinished])

  if (items.length === 0) return null

  return (
    <section
      aria-label="Envios"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="fixed right-4 bottom-4 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl glass-strong text-popover-foreground shadow-overlay"
    >
      <header className="flex items-center gap-2 border-b border-glass-border px-3 py-2">
        <p className="flex-1 text-sm font-medium" aria-live="polite">
          {active > 0 ? `Enviando ${active} de ${items.length}` : `${items.length} ${items.length === 1 ? "item" : "itens"}`}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? "Expandir" : "Recolher"}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Fechar"
          title={active > 0 ? "Fechar (os envios em andamento continuam na lista)" : "Fechar"}
          onClick={clearFinished}
        >
          <XIcon />
        </Button>
      </header>
      {collapsed ? null : (
        <ul className="max-h-80 divide-y divide-glass-border overflow-y-auto">
          {items.map((item) => (
            <TrayRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

function TrayRow({ item }: { item: IngestItem }) {
  const { retry, remove, addFiles } = useIngest()
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = !FINISHED.has(item.status)

  return (
    <li className="flex gap-3 px-3 py-2.5">
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-media text-media-foreground">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={item.previewUrl} alt="" className="size-full object-cover" />
        ) : item.kind === "link" ? (
          <LinkIcon className="size-4" aria-hidden />
        ) : (
          <FileVideoIcon className="size-4" aria-hidden />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm" title={item.label}>
          {item.label}
        </p>
        <p
          className={cn(
            "flex items-center gap-1 text-xs text-muted-foreground",
            item.status === "error" && "text-destructive",
          )}
        >
          {busy ? <Loader2Icon className="size-3 animate-spin" aria-hidden /> : null}
          {item.status === "done" ? <CheckIcon className="size-3" aria-hidden /> : null}
          {item.status === "error" ? <AlertCircleIcon className="size-3" aria-hidden /> : null}
          <span className="truncate">
            {item.status === "error" ? item.error : STATUS_LABEL[item.status]}
            {item.status === "uploading" ? ` ${item.progress}%` : null}
          </span>
        </p>
        {item.status === "uploading" ? (
          <div className="h-0.5 overflow-hidden bg-background" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-gradient-accent transition-[width]" style={{ width: `${item.progress}%` }} />
          </div>
        ) : null}
        {item.duplicates.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Possível duplicata de “{item.duplicates[0]?.title ?? "uma referência existente"}”
            {item.duplicates.length > 1 ? ` e mais ${item.duplicates.length - 1}` : ""}.
          </p>
        ) : null}
        {item.status === "link-only" && item.referenceId ? (
          <>
            <p className="text-xs text-muted-foreground">O link foi salvo. Envie o arquivo manualmente, se tiver.</p>
            <div>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <UploadIcon /> Enviar arquivo
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && item.referenceId) {
                    addFiles([file], { attachTo: item.referenceId })
                    remove(item.id)
                  }
                  e.target.value = ""
                }}
              />
            </div>
          </>
        ) : null}
      </div>
      <div className="flex shrink-0 items-start gap-0.5">
        {item.status === "error" ? (
          <Button variant="ghost" size="icon-sm" aria-label="Tentar de novo" onClick={() => retry(item.id)}>
            <RotateCcwIcon />
          </Button>
        ) : null}
        {!busy ? (
          <Button variant="ghost" size="icon-sm" aria-label="Remover da lista" onClick={() => remove(item.id)}>
            <XIcon />
          </Button>
        ) : null}
      </div>
    </li>
  )
}
