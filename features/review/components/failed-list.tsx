"use client"

import { AlertTriangleIcon, CheckCircle2Icon, RotateCcwIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shell/empty-state"
import { Button } from "@/components/ui/button"
import { useAnalysis } from "@/features/analysis/analysis-provider"
import type { ReferenceView } from "@/lib/references/view"

import { DeleteReferenceDialog } from "./delete-reference-dialog"

function poster(r: ReferenceView): string | null {
  const m = r.media
  if (m.kind === "image") return m.thumb ?? m.src
  if (m.kind === "video" || m.kind === "embed" || m.kind === "none") return m.poster
  return null
}

export function FailedList({ items }: { items: ReferenceView[] }) {
  const router = useRouter()
  const { retryFailed } = useAnalysis()
  const [busy, setBusy] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ReferenceView | null>(null)

  async function retry(ids?: string[]) {
    setBusy(ids?.[0] ?? "all")
    try {
      const n = await retryFailed(ids)
      toast.success(`${n} ${n === 1 ? "item reenviado" : "itens reenviados"} para análise.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao reenviar.")
    } finally {
      setBusy(null)
    }
  }

  if (items.length === 0) {
    return <EmptyState icon={CheckCircle2Icon} title="Nenhuma falha" description="Todas as análises deram certo." />
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          A análise desistiu destes itens após várias tentativas. Tente de novo ou exclua.
        </p>
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void retry()}>
          <RotateCcwIcon /> Tentar todas de novo
        </Button>
      </div>
      <ul className="glass divide-y divide-glass-border overflow-hidden rounded-2xl">
        {items.map((r) => {
          const src = poster(r)
          return (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-media">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
                  <img src={src} alt="" className="size-full object-cover" />
                ) : (
                  <AlertTriangleIcon className="size-4 text-media-foreground" aria-hidden />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-sm">{r.title ?? "Sem título"}</p>
                <p className="line-clamp-2 text-xs text-destructive">{r.analysis_error ?? "Erro desconhecido."}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Tentar de novo"
                disabled={busy !== null}
                onClick={() => void retry([r.id])}
              >
                <RotateCcwIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Excluir" onClick={() => setDeleting(r)}>
                <Trash2Icon />
              </Button>
            </li>
          )
        })}
      </ul>
      <DeleteReferenceDialog
        reference={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => router.refresh()}
      />
    </div>
  )
}
