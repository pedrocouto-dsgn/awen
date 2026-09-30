"use client"

import { CheckIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, UsersIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Avatar } from "@/components/shell/avatar"

import { ConfirmDialog } from "@/components/shell/confirm-dialog"
import { EmptyState } from "@/components/shell/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ROLE_LABEL } from "@/lib/validation/entities"
import type { PersonRole } from "@/types/database"

export type PersonRow = { id: string; name: string; photoUrl: string | null; count: number; roles: PersonRole[] }

async function api(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? "Algo deu errado.")
  return data
}

export function PeopleList({ people }: { people: PersonRow[] }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [newName, setNewName] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deleting, setDeleting] = useState<PersonRow | null>(null)

  const needle = q.trim().toLowerCase()
  const visible = needle ? people.filter((p) => p.name.toLowerCase().includes(needle)) : people

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await api("/api/people", { method: "POST", body: JSON.stringify({ name: newName }) })
      setNewName("")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar.")
    }
  }

  async function rename(id: string) {
    try {
      await api(`/api/people/${id}`, { method: "PATCH", body: JSON.stringify({ name: editName }) })
      setEditing(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível renomear.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-4 pb-8 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="type-display-lg">Artistas</h1>
        <p className="text-muted-foreground">Diretores, fotógrafos e artistas ligados às suas referências.</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar artistas" aria-label="Filtrar artistas" className="bg-card pl-10" />
        </div>
        <form onSubmit={create} className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Novo artista" aria-label="Nome do novo artista" />
          <Button type="submit" size="default" disabled={!newName.trim()}>
            <PlusIcon /> Criar
          </Button>
        </form>
      </div>

      {people.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Nenhum artista ainda"
          description="Vincule artistas às referências na revisão ou no detalhe, ou crie aqui."
        />
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Ninguém com esse nome.</p>
      ) : (
        <ul className="glass flex flex-col divide-y divide-glass-border overflow-hidden rounded-2xl">
          {visible.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-5 py-4">
              {editing === p.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void rename(p.id)
                  }}
                >
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus aria-label="Novo nome" />
                  <Button type="submit" variant="outline" size="icon" aria-label="Salvar nome">
                    <CheckIcon />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Cancelar" onClick={() => setEditing(null)}>
                    <XIcon />
                  </Button>
                </form>
              ) : (
                <>
                  <Avatar name={p.name} url={p.photoUrl} className="size-11" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/people/${p.id}`} className="type-title-sm truncate hover:underline">
                      {p.name}
                    </Link>
                    <p className="type-caption text-muted-foreground">
                      {p.count} {p.count === 1 ? "referência" : "referências"}
                      {p.roles.length ? ` · ${p.roles.map((r) => ROLE_LABEL[r]).join(", ")}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Renomear ${p.name}`}
                    onClick={() => {
                      setEditing(p.id)
                      setEditName(p.name)
                    }}
                  >
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${p.name}`} onClick={() => setDeleting(p)}>
                    <Trash2Icon />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir artista?"
        description={`“${deleting?.name ?? ""}” será removido e desvinculado das referências. As referências continuam na biblioteca.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api(`/api/people/${deleting.id}`, { method: "DELETE" })
            router.refresh()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível excluir.")
          }
        }}
      />
    </div>
  )
}
