"use client"

import { ArchiveIcon, ArchiveRestoreIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { VocabMap, VocabTerm } from "@/lib/references/vocab"
import { cn } from "@/lib/utils"
import type { VocabCategory } from "@/types/database"

const CATEGORIES: { key: VocabCategory; label: string; hint: string }[] = [
  { key: "shot_type", label: "Plano", hint: "Tamanho do plano / enquadramento." },
  { key: "camera_angle", label: "Ângulo", hint: "Ângulo da câmera em relação ao assunto." },
  { key: "camera_movement", label: "Movimento", hint: "Movimento de câmera (só vídeos)." },
  { key: "lighting", label: "Luz", hint: "Características de luz (várias por referência)." },
  { key: "mood", label: "Clima", hint: "Tom emocional (vários por referência)." },
]

type Counts = Record<VocabCategory, Record<string, number>>

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) throw new Error(data?.error ?? "Algo deu errado.")
  return data as T
}

export function VocabularyEditor({ vocab: initial, counts }: { vocab: VocabMap; counts: Counts }) {
  const router = useRouter()
  const [vocab, setVocab] = useState(initial)
  const [category, setCategory] = useState<VocabCategory>("shot_type")
  const [newTerm, setNewTerm] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [busy, setBusy] = useState(false)

  const terms = vocab[category]
  const active = terms.filter((t) => !t.archived)
  const archived = terms.filter((t) => t.archived)
  const meta = CATEGORIES.find((c) => c.key === category)!

  const replace = (updated: VocabTerm) =>
    setVocab((v) => ({ ...v, [category]: v[category].map((t) => (t.id === updated.id ? updated : t)) }))

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!newTerm.trim()) return
    setBusy(true)
    try {
      const term = await api<VocabTerm>("/api/vocabularies", {
        method: "POST",
        body: JSON.stringify({ category, term: newTerm }),
      })
      setVocab((v) => ({ ...v, [category]: [...v[category].filter((t) => t.id !== term.id), term] }))
      setNewTerm("")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar.")
    } finally {
      setBusy(false)
    }
  }

  async function rename(t: VocabTerm) {
    if (!editValue.trim() || editValue.trim() === t.term) {
      setEditing(null)
      return
    }
    setBusy(true)
    try {
      const updated = await api<VocabTerm>(`/api/vocabularies/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ term: editValue }),
      })
      replace(updated)
      setEditing(null)
      const used = counts[category][t.term] ?? 0
      toast.success(used ? `Renomeado. ${used} ${used === 1 ? "referência atualizada" : "referências atualizadas"}.` : "Renomeado.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível renomear.")
    } finally {
      setBusy(false)
    }
  }

  async function setArchived(t: VocabTerm, value: boolean) {
    replace({ ...t, archived: value })
    try {
      await api(`/api/vocabularies/${t.id}`, { method: "PATCH", body: JSON.stringify({ archived: value }) })
      router.refresh()
    } catch (error) {
      replace(t)
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar.")
    }
  }

  async function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= active.length) return
    const order = [...active]
    const [item] = order.splice(index, 1)
    order.splice(target, 0, item!)
    const next = [...order.map((t, i) => ({ ...t, sort_order: i + 1 })), ...archived]
    const previous = vocab[category]
    setVocab((v) => ({ ...v, [category]: next }))
    try {
      await api("/api/vocabularies/order", {
        method: "PUT",
        body: JSON.stringify({ category, ids: next.map((t) => t.id) }),
      })
    } catch (error) {
      setVocab((v) => ({ ...v, [category]: previous }))
      toast.error(error instanceof Error ? error.message : "Não foi possível reordenar.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Categorias" className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            role="tab"
            type="button"
            aria-selected={category === c.key}
            onClick={() => {
              setCategory(c.key)
              setEditing(null)
            }}
            className={cn(
              "type-nav h-9 border px-4 transition-colors",
              category === c.key
                ? "border-transparent bg-gradient-steel text-foreground"
                : "border-border-strong text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
            <span className="ml-2 tabular-nums opacity-70">{vocab[c.key].filter((t) => !t.archived).length}</span>
          </button>
        ))}
      </div>

      <section role="tabpanel" aria-label={meta.label} className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          {meta.hint} A IA só escolhe entre os termos ativos. Termos arquivados continuam nas referências que já os usam.
        </p>

        <ul className="flex flex-col border-t">
          {active.map((t, i) => {
            const used = counts[category][t.term] ?? 0
            return (
              <li key={t.id} className="flex items-center gap-2 border-b py-2.5">
                {editing === t.id ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void rename(t)
                    }}
                  >
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      maxLength={60}
                      aria-label={`Novo nome para ${t.term}`}
                      onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                    />
                    <Button type="submit" variant="outline" size="icon-sm" aria-label="Salvar" disabled={busy}>
                      <CheckIcon />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancelar" onClick={() => setEditing(null)}>
                      <XIcon />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 truncate">{t.term}</span>
                    <span className="type-caption w-24 text-right text-muted-foreground tabular-nums">
                      {used} {used === 1 ? "uso" : "usos"}
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Subir ${t.term}`} disabled={i === 0} onClick={() => void move(i, -1)}>
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Descer ${t.term}`}
                      disabled={i === active.length - 1}
                      onClick={() => void move(i, 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Renomear ${t.term}`}
                      onClick={() => {
                        setEditing(t.id)
                        setEditValue(t.term)
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Arquivar ${t.term}`} onClick={() => void setArchived(t, true)}>
                      <ArchiveIcon />
                    </Button>
                  </>
                )}
              </li>
            )
          })}
        </ul>

        <form onSubmit={add} className="flex gap-2">
          <Input
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            placeholder={`Novo termo em ${meta.label.toLowerCase()} (em inglês)`}
            aria-label="Novo termo"
            maxLength={60}
          />
          <Button type="submit" disabled={busy || !newTerm.trim()}>
            <PlusIcon /> Adicionar
          </Button>
        </form>

        {archived.length > 0 ? (
          <div className="flex flex-col gap-2 pt-4">
            <h3 className="type-label text-muted-foreground">Arquivados</h3>
            <ul className="flex flex-col border-t">
              {archived.map((t) => (
                <li key={t.id} className="flex items-center gap-2 border-b py-2 text-muted-foreground">
                  <span className="flex-1 truncate line-through decoration-1">{t.term}</span>
                  <span className="type-caption w-24 text-right tabular-nums">
                    {counts[category][t.term] ?? 0} usos
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => void setArchived(t, false)}>
                    <ArchiveRestoreIcon /> Restaurar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  )
}
