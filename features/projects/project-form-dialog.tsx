"use client"

import { Loader2Icon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: { id: string; name: string; description: string | null }
  onSaved: (project: { id: string; name: string }) => void
}

/** Create or edit a project (name + description). */
export function ProjectFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const uid = useId()
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const res = await fetch(initial ? `/api/projects/${initial.id}` : "/api/projects", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      })
      const data = (await res.json()) as { id: string; name: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.")
      onSaved(data)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${uid}-name`} className="type-label text-muted-foreground">
              Nome
            </label>
            <Input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${uid}-description`} className="type-label text-muted-foreground">
              Descrição
            </label>
            <Textarea
              id={`${uid}-description`}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : null} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
