"use client"

import { BlocksIcon, CheckIcon, CopyIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shell/confirm-dialog"
import { EmptyState } from "@/components/shell/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiJson } from "@/features/ingest/upload"

import { BlockDialog, type BlockItem } from "./block-dialog"

/** The "Blocos" tab: reusable pieces of prompt text, grouped by category. */
export function BlocksManager({ initialBlocks }: { initialBlocks: BlockItem[] }) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<BlockItem | null | "new">(null)
  const [deleting, setDeleting] = useState<BlockItem | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const categories = useMemo(
    () => [...new Set(blocks.map((b) => b.category).filter((c): c is string => Boolean(c)))],
    [blocks],
  )
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const visible = needle
      ? blocks.filter((b) => [b.name, b.category ?? "", b.body].some((t) => t.toLowerCase().includes(needle)))
      : blocks
    const map = new Map<string, BlockItem[]>()
    for (const b of visible) {
      const key = b.category ?? "Sem categoria"
      map.set(key, [...(map.get(key) ?? []), b])
    }
    return [...map.entries()].sort(([a], [b]) => (a === "Sem categoria" ? 1 : b === "Sem categoria" ? -1 : a.localeCompare(b, "pt-BR")))
  }, [blocks, query])

  async function copy(block: BlockItem) {
    try {
      await navigator.clipboard.writeText(block.body)
      setCopied(block.id)
      setTimeout(() => setCopied((c) => (c === block.id ? null : c)), 1500)
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  async function remove(block: BlockItem) {
    try {
      await apiJson(`/api/prompt-blocks/${block.id}`, { method: "DELETE" })
      setBlocks((list) => list.filter((b) => b.id !== block.id))
      toast.success("Bloco excluído.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar blocos"
            aria-label="Buscar blocos"
            className="h-11 bg-card pl-10"
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {blocks.length} {blocks.length === 1 ? "bloco" : "blocos"}
        </p>
        <Button size="sm" className="ml-auto" onClick={() => setEditing("new")}>
          <PlusIcon /> Novo bloco
        </Button>
      </div>

      {blocks.length === 0 ? (
        <EmptyState
          icon={BlocksIcon}
          title="Nenhum bloco ainda"
          description="Guarde trechos que você reaproveita, como um esquema de luz, de câmera ou de materiais. Dentro de um prompt, selecione o texto e use “Salvar trecho como bloco”."
        />
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum bloco encontrado.</p>
      ) : (
        groups.map(([category, list]) => (
          <section key={category} className="flex flex-col gap-3" aria-label={category}>
            <h2 className="type-label text-muted-foreground">
              {category} · {list.length}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {list.map((b) => (
                <li key={b.id} className="glass flex flex-col gap-3 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{b.name}</p>
                    <Button variant={copied === b.id ? "secondary" : "outline"} size="xs" onClick={() => void copy(b)}>
                      {copied === b.id ? <CheckIcon /> : <CopyIcon />} {copied === b.id ? "Copiado" : "Copiar"}
                    </Button>
                    <Button variant="ghost" size="icon-xs" aria-label={`Editar ${b.name}`} onClick={() => setEditing(b)}>
                      <PencilIcon />
                    </Button>
                    <Button variant="ghost" size="icon-xs" aria-label={`Excluir ${b.name}`} onClick={() => setDeleting(b)}>
                      <Trash2Icon />
                    </Button>
                  </div>
                  <p className="line-clamp-6 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{b.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <BlockDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        block={editing === "new" ? null : editing}
        categories={categories}
        onSaved={(saved) =>
          setBlocks((list) =>
            list.some((b) => b.id === saved.id) ? list.map((b) => (b.id === saved.id ? saved : b)) : [...list, saved],
          )
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir “${deleting?.name ?? ""}”?`}
        description="Os prompts que já usaram este texto não mudam."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (deleting) await remove(deleting)
          setDeleting(null)
        }}
      />
    </div>
  )
}
