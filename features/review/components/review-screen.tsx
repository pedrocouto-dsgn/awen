"use client"

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shell/empty-state"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAnalysis } from "@/features/analysis/analysis-provider"
import { ACCEPT } from "@/features/ingest/components/add-reference-dialog"
import { useIngest } from "@/features/ingest/ingest-provider"
import { MediaViewer } from "@/features/media/media-viewer"
import { ReferenceLinks } from "@/features/references/reference-links"
import type { ActiveProject } from "@/lib/references/links"
import type { ReferenceView } from "@/lib/references/view"
import type { VocabMap, VocabTerm } from "@/lib/references/vocab"
import type { VocabCategory } from "@/types/database"

import type { ReviewItem } from "../data"
import { DeleteReferenceDialog } from "./delete-reference-dialog"
import { draftFrom, ReviewPanel, type ReviewDraft } from "./review-panel"

type Props = { items: ReviewItem[]; vocab: VocabMap; queued: number; activeProject: ActiveProject }

async function patchReference(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/references/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar.")
}

/** Only the fields that changed, so untouched AI values are not rewritten. */
function diff(original: ReviewDraft, draft: ReviewDraft): Partial<ReviewDraft> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(draft) as (keyof ReviewDraft)[]) {
    if (JSON.stringify(original[key]) !== JSON.stringify(draft[key])) out[key] = draft[key]
  }
  return out as Partial<ReviewDraft>
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    Boolean(target.closest("[role=listbox],[role=menu],[role=dialog]"))
  )
}

export function ReviewScreen({ items, vocab: initialVocab, queued, activeProject }: Props) {
  const router = useRouter()
  const { retryFailed, refreshStats } = useAnalysis()
  const { addFiles } = useIngest()

  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [currentId, setCurrentId] = useState<string | null>(items[0]?.id ?? null)
  const [lastIndex, setLastIndex] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({})
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<ReferenceView | null>(null)
  const [vocab, setVocab] = useState(initialVocab)
  const fileRef = useRef<HTMLInputElement>(null)

  // The server list refreshes as analyses finish; keep the local view stable on top of it.
  const list = useMemo(() => items.filter((i) => !hidden.has(i.id)), [items, hidden])
  const index = useMemo(() => {
    const found = list.findIndex((i) => i.id === currentId)
    return found >= 0 ? found : Math.min(lastIndex, Math.max(0, list.length - 1))
  }, [list, currentId, lastIndex])
  const current = list[index] ?? null
  const draft = current ? (drafts[current.id] ?? draftFrom(current)) : null

  const goTo = useCallback(
    (i: number) => {
      const target = list[Math.max(0, Math.min(list.length - 1, i))]
      if (!target) return
      setCurrentId(target.id)
      setLastIndex(i)
      setEditing(false)
    },
    [list],
  )

  const updateDraft = useCallback(
    (patch: Partial<ReviewDraft>) => {
      if (!current) return
      setDrafts((d) => ({ ...d, [current.id]: { ...(d[current.id] ?? draftFrom(current)), ...patch } }))
    },
    [current],
  )

  const resetDraft = useCallback(() => {
    if (!current) return
    setDrafts((d) => {
      const next = { ...d }
      delete next[current.id]
      return next
    })
    setEditing(false)
  }, [current])

  const decide = useCallback(
    async (status: "approved" | "rejected") => {
      if (!current || !draft || busy) return
      const target = current
      const changes = diff(draftFrom(target), draft)
      setBusy(true)
      try {
        await patchReference(target.id, { ...changes, status })
        setHidden((h) => new Set(h).add(target.id))
        setLastIndex(index)
        setCurrentId(list[index + 1]?.id ?? list[index - 1]?.id ?? null)
        setEditing(false)
        toast(status === "approved" ? "Aprovada. Já está na Biblioteca." : "Rejeitada.", {
          action: {
            label: "Desfazer",
            onClick: async () => {
              try {
                await patchReference(target.id, { status: "pending" })
                setHidden((h) => {
                  const next = new Set(h)
                  next.delete(target.id)
                  return next
                })
                setCurrentId(target.id)
                router.refresh()
                void refreshStats()
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Não foi possível desfazer.")
              }
            },
          },
        })
        router.refresh()
        void refreshStats()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar.")
      } finally {
        setBusy(false)
      }
    },
    [busy, current, draft, index, list, refreshStats, router],
  )

  const saveEdits = useCallback(async () => {
    if (!current || !draft || busy) return
    const changes = diff(draftFrom(current), draft)
    if (Object.keys(changes).length === 0) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await patchReference(current.id, changes)
      setEditing(false)
      toast.success("Alterações salvas.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.")
    } finally {
      setBusy(false)
    }
  }, [busy, current, draft, router])

  const acceptSuggestion = useCallback(
    async (category: VocabCategory, term: string) => {
      try {
        const res = await fetch("/api/vocabularies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, term }),
        })
        const data = (await res.json()) as VocabTerm & { error?: string }
        if (!res.ok) throw new Error(data.error ?? "Não foi possível adicionar o termo.")
        setVocab((v) => ({
          ...v,
          [category]: [...v[category].filter((t) => t.id !== data.id), { ...data, archived: false }],
        }))
        if (category === "lighting" || category === "mood") {
          const currentValues = draft?.[category] ?? []
          updateDraft({ [category]: [...new Set([...currentValues, data.term])] })
        } else {
          updateDraft({ [category]: data.term })
        }
        toast.success(`“${data.term}” adicionado ao vocabulário.`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao adicionar termo.")
      }
    },
    [draft, updateDraft],
  )

  const reanalyze = useCallback(async () => {
    if (!current) return
    try {
      await retryFailed([current.id])
      setHidden((h) => new Set(h).add(current.id))
      toast("Enviada de novo para análise.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao reenviar.")
    }
  }, [current, retryFailed])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return
      if (editing) {
        if (e.key === "Escape") {
          e.preventDefault()
          resetDraft()
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          void saveEdits()
        }
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === "a") void decide("approved")
      else if (key === "r") void decide("rejected")
      else if (key === "e") setEditing(true)
      else if (e.key === "ArrowRight") goTo(index + 1)
      else if (e.key === "ArrowLeft") goTo(index - 1)
      else if (/^[1-5]$/.test(e.key)) updateDraft({ rating: Number(e.key) })
      else if (e.key === "0") updateDraft({ rating: null })
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, decide, editing, goTo, index, resetDraft, saveEdits, updateDraft])

  if (!current || !draft) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="Nada para revisar"
        description={
          queued > 0
            ? `${queued} ${queued === 1 ? "referência está" : "referências estão"} na fila de análise. Elas aparecem aqui quando a IA terminar.`
            : "Quando novas referências forem analisadas, elas aparecem aqui, uma de cada vez."
        }
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section aria-label="Mídia" className="relative h-[55svh] shrink-0 lg:h-auto lg:min-h-0 lg:min-w-0 lg:flex-1">
        <MediaViewer media={current.media} aspectRatio={current.aspect_ratio} title={current.title}>
          {current.media.kind === "none" ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
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
                  if (file) {
                    addFiles([file], { attachTo: current.id })
                    setHidden((h) => new Set(h).add(current.id))
                  }
                  e.target.value = ""
                }}
              />
            </>
          ) : null}
        </MediaViewer>
      </section>

      <aside
        aria-label="Dados da referência"
        className="flex min-h-0 w-full flex-col border-t bg-gradient-dusk lg:w-[420px] lg:border-t-0 lg:border-l"
      >
        <div className="relative flex items-center gap-1 border-b px-4 py-2">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-card" aria-hidden>
            <div
              className="h-full bg-gradient-accent transition-[width]"
              style={{ width: `${((index + 1) / Math.max(1, list.length)) * 100}%` }}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Anterior (←)"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {index + 1} de {list.length}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próxima (→)"
            disabled={index >= list.length - 1}
            onClick={() => goTo(index + 1)}
          >
            <ChevronRightIcon />
          </Button>
          {queued > 0 ? (
            <span className="ml-2 text-xs text-muted-foreground">+{queued} em análise</span>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Mais ações">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {current.media_ready ? (
                <DropdownMenuItem onSelect={() => void reanalyze()}>
                  <RotateCcwIcon /> Analisar de novo
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(current)}>
                <Trash2Icon /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <ReviewPanel
            key={current.id}
            reference={current}
            vocab={vocab}
            editing={editing}
            draft={draft}
            onDraftChange={updateDraft}
            onAcceptSuggestion={(c, t) => void acceptSuggestion(c, t)}
          />
          <div className="mt-6">
            <ReferenceLinks
              key={current.id}
              referenceId={current.id}
              referenceType={current.type}
              initialPeople={current.links.people}
              initialProjects={current.links.projects}
              activeProject={activeProject}
              aiArtist={current.ai?.artist ?? null}
              shortcuts={!editing}
            />
          </div>
        </div>

        <div className="flex min-h-[72px] items-center gap-2 border-t bg-background px-4 py-3">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={resetDraft} disabled={busy}>
                Cancelar <Kbd>Esc</Kbd>
              </Button>
              <Button variant="outline" size="sm" onClick={() => void saveEdits()} disabled={busy}>
                Salvar <Kbd>⌘↵</Kbd>
              </Button>
            </>
          ) : (
            <>
              <Button variant="destructive" size="sm" onClick={() => void decide("rejected")} disabled={busy}>
                <XIcon /> Rejeitar <Kbd>R</Kbd>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={busy}>
                <PencilIcon /> Editar <Kbd>E</Kbd>
              </Button>
            </>
          )}
          <Button variant="accent" size="sm" className="ml-auto" onClick={() => void decide("approved")} disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Aprovar {editing ? null : <Kbd>A</Kbd>}
          </Button>
        </div>
      </aside>

      <DeleteReferenceDialog
        reference={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={(id) => {
          setHidden((h) => new Set(h).add(id))
          router.refresh()
          void refreshStats()
        }}
      />
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="hidden border border-current/40 px-1 font-mono text-[10px] leading-4 tracking-normal opacity-70 sm:inline">
      {children}
    </kbd>
  )
}
