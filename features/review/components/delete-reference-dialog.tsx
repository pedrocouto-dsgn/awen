"use client"

import { Loader2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  reference: { id: string; title: string | null } | null
  onOpenChange: (open: boolean) => void
  onDeleted: (id: string) => void
}

/** Permanent delete (row + files). Uses an in-app dialog, never window.confirm. */
export function DeleteReferenceDialog({ reference, onOpenChange, onDeleted }: Props) {
  const [pending, setPending] = useState(false)

  async function confirm() {
    if (!reference) return
    setPending(true)
    try {
      const res = await fetch(`/api/references/${reference.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Não foi possível excluir.")
      }
      onDeleted(reference.id)
      onOpenChange(false)
      toast.success("Referência excluída.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={Boolean(reference)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir referência?</DialogTitle>
          <DialogDescription>
            “{reference?.title ?? "Sem título"}” e os arquivos dela serão apagados de vez. Isso não pode ser desfeito.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null} Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
