"use client"

import { Loader2Icon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { apiJson } from "@/features/ingest/upload"
import { BLOCK_CATEGORIES } from "@/lib/prompts/options"

export type BlockItem = { id: string; name: string; category: string | null; body: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editing this block; otherwise a new one. */
  block?: BlockItem | null
  /** Starting text for a new block (e.g. the selection in a prompt). */
  initialBody?: string
  /** Categories already in use, offered next to the defaults. */
  categories?: string[]
  onSaved: (block: BlockItem) => void
}

export function BlockDialog({ open, onOpenChange, block, initialBody = "", categories = [], onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{block ? "Editar bloco" : "Novo bloco"}</DialogTitle>
          <DialogDescription>Um trecho que você reaproveita em vários prompts, como um esquema de luz ou de câmera.</DialogDescription>
        </DialogHeader>
        {/* The content unmounts when closed, so the form starts fresh every time. */}
        <BlockForm
          block={block ?? null}
          initialBody={initialBody}
          categories={categories}
          onCancel={() => onOpenChange(false)}
          onSaved={(saved) => {
            onSaved(saved)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function BlockForm({
  block,
  initialBody,
  categories,
  onCancel,
  onSaved,
}: {
  block: BlockItem | null
  initialBody: string
  categories: string[]
  onCancel: () => void
  onSaved: (block: BlockItem) => void
}) {
  const uid = useId()
  const [name, setName] = useState(block?.name ?? "")
  const [category, setCategory] = useState(block?.category ?? "")
  const [body, setBody] = useState(block?.body ?? initialBody)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const payload = JSON.stringify({ name, category: category || null, body })
      const saved = block
        ? await apiJson<BlockItem>(`/api/prompt-blocks/${block.id}`, { method: "PATCH", body: payload })
        : await apiJson<BlockItem>("/api/prompt-blocks", { method: "POST", body: payload })
      toast.success(block ? "Bloco salvo." : "Bloco criado.")
      onSaved(saved)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o bloco.")
    } finally {
      setSaving(false)
    }
  }

  const suggestions = [...new Set([...categories, ...BLOCK_CATEGORIES])]

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        // A block saved from inside the prompt form must not submit that form too.
        e.stopPropagation()
        void save()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="type-label text-muted-foreground">Nome</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contraluz dourada" autoFocus required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="type-label text-muted-foreground">Categoria</span>
          <Input list={`${uid}-cats`} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Iluminação" />
          <datalist id={`${uid}-cats`}>
            {suggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="type-label text-muted-foreground">Texto</span>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="max-h-[50svh] min-h-40 font-mono text-[13px] leading-relaxed"
          required
        />
      </label>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || !name.trim() || !body.trim()}>
          {saving ? <Loader2Icon className="animate-spin" /> : null} Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
