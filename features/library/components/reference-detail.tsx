"use client"

import {
  ArrowLeftIcon,
  InboxIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAnalysis } from "@/features/analysis/analysis-provider"
import { MediaViewer } from "@/features/media/media-viewer"
import { DeleteReferenceDialog } from "@/features/review/components/delete-reference-dialog"
import { draftFrom, ReviewPanel, type ReviewDraft } from "@/features/review/components/review-panel"
import type { ReferenceView } from "@/lib/references/view"
import type { VocabMap, VocabTerm } from "@/lib/references/vocab"
import type { VocabCategory } from "@/types/database"

const STATUS_LABEL: Record<ReferenceView["status"], string> = {
  pending: "Aguardando revisão",
  analyzing: "Em análise",
  approved: "Aprovada",
  rejected: "Rejeitada",
  failed: "Análise falhou",
}

async function patchReference(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/references/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar.")
}

function changed(original: ReviewDraft, draft: ReviewDraft) {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(draft) as (keyof ReviewDraft)[]) {
    if (JSON.stringify(original[k]) !== JSON.stringify(draft[k])) out[k] = draft[k]
  }
  return out
}

export function ReferenceDetail({
  reference,
  vocab: initialVocab,
  children,
}: {
  reference: ReferenceView
  vocab: VocabMap
  /** Extra sections (people, projects). */
  children?: React.ReactNode
}) {
  const router = useRouter()
  const { refreshStats } = useAnalysis()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => draftFrom(reference))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [vocab, setVocab] = useState(initialVocab)

  const original = draftFrom(reference)
  const dirty = Object.keys(changed(original, draft)).length > 0

  const save = useCallback(async () => {
    const changes = changed(draftFrom(reference), draft)
    if (Object.keys(changes).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await patchReference(reference.id, changes)
      toast.success("Alterações salvas.")
      setEditing(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }, [draft, reference, router])

  // Rating (1-5 keys) saves right away; E edits; Esc cancels; Cmd+Enter saves.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const typing = t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
      if (editing) {
        if (e.key === "Escape") {
          setDraft(draftFrom(reference))
          setEditing(false)
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          void save()
        }
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === "e") {
        e.preventDefault()
        setEditing(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editing, reference, save])

  async function onDraftChange(patch: Partial<ReviewDraft>) {
    setDraft((d) => ({ ...d, ...patch }))
    // Outside edit mode only the rating can change: persist it immediately.
    if (!editing && "rating" in patch) {
      try {
        await patchReference(reference.id, { rating: patch.rating ?? null })
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar a nota.")
      }
    }
  }

  async function acceptSuggestion(category: VocabCategory, term: string) {
    try {
      const res = await fetch("/api/vocabularies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, term }),
      })
      const data = (await res.json()) as VocabTerm & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Não foi possível adicionar o termo.")
      setVocab((v) => ({ ...v, [category]: [...v[category].filter((t) => t.id !== data.id), { ...data, archived: false }] }))
      setEditing(true)
      setDraft((d) =>
        category === "lighting" || category === "mood"
          ? { ...d, [category]: [...new Set([...d[category], data.term])] }
          : { ...d, [category]: data.term },
      )
      toast.success(`“${data.term}” adicionado. Salve para aplicar.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar termo.")
    }
  }

  async function sendBackToReview() {
    try {
      await patchReference(reference.id, { status: "pending" })
      toast.success("Voltou para a revisão.")
      void refreshStats()
      router.push("/library")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível mover.")
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 pt-0 lg:flex-row lg:overflow-hidden">
      <section
        aria-label="Mídia"
        className="relative h-[60svh] shrink-0 overflow-hidden rounded-2xl bg-media lg:h-auto lg:min-h-0 lg:min-w-0 lg:flex-1"
      >
        <Button
          variant="outline"
          size="sm"
          className="glass-strong absolute top-4 left-4 z-10"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/library"))}
        >
          <ArrowLeftIcon /> Voltar
        </Button>
        <MediaViewer media={reference.media} aspectRatio={reference.aspect_ratio} title={reference.title} />
      </section>

      <aside
        aria-label="Dados da referência"
        className="glass flex min-h-0 w-full flex-col overflow-hidden rounded-2xl lg:w-[420px]"
      >
        <div className="flex items-center gap-2 border-b border-glass-border px-4 py-2">
          {reference.status !== "approved" ? <Badge variant="outline">{STATUS_LABEL[reference.status]}</Badge> : null}
          <div className="ml-auto flex items-center gap-1">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setDraft(draftFrom(reference))
                    setEditing(false)
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" disabled={saving || !dirty} onClick={() => void save()}>
                  {saving ? <Loader2Icon className="animate-spin" /> : null} Salvar
                </Button>
              </>
            ) : (
              <>
                {reference.status === "approved" ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/library?parecida=${reference.id}`}>
                      <SparklesIcon /> Parecidas
                    </Link>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <PencilIcon /> Editar
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {reference.status === "approved" ? (
                  <DropdownMenuItem onSelect={() => void sendBackToReview()}>
                    <InboxIcon /> Voltar para a revisão
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  <Trash2Icon /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <ReviewPanel
            reference={reference}
            vocab={vocab}
            editing={editing}
            draft={draft}
            onDraftChange={(p) => void onDraftChange(p)}
            onAcceptSuggestion={(c, t) => void acceptSuggestion(c, t)}
          />
          {children ? <div className="mt-6 flex flex-col gap-6">{children}</div> : null}
        </div>
      </aside>

      <DeleteReferenceDialog
        reference={deleting ? reference : null}
        onOpenChange={(open) => !open && setDeleting(false)}
        onDeleted={() => {
          router.push("/library")
          router.refresh()
        }}
      />
    </div>
  )
}
