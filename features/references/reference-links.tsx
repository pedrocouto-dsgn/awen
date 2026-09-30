"use client"

import { FolderPlusIcon, SparklesIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ActiveProject, LinkedPerson, LinkedProject } from "@/lib/references/links"
import { ROLE_LABEL } from "@/lib/validation/entities"
import type { PersonRole } from "@/types/database"

import { EntityCombobox, type EntityOption } from "./entity-combobox"

type Props = {
  referenceId: string
  referenceType: "image" | "video"
  initialPeople: LinkedPerson[]
  initialProjects: LinkedProject[]
  activeProject: ActiveProject
  aiArtist: { name: string | null; confidence: "low" | "medium" | "high" } | null
  /** Enables the "P" shortcut (add to active project). */
  shortcuts?: boolean
}

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) throw new Error(data?.error ?? "Algo deu errado.")
  return data as T
}

const searchPeople = async (q: string) =>
  (await (await fetch(`/api/people?q=${encodeURIComponent(q)}`)).json()) as EntityOption[]

const searchProjects = async (q: string) => {
  const all = (await (await fetch("/api/projects")).json()) as EntityOption[]
  const needle = q.trim().toLowerCase()
  return needle ? all.filter((p) => p.name.toLowerCase().includes(needle)) : all
}

const CONFIDENCE = { low: "baixa", medium: "média", high: "alta" } as const

/** People and projects of a reference. Changes are saved immediately. */
export function ReferenceLinks({
  referenceId,
  referenceType,
  initialPeople,
  initialProjects,
  activeProject,
  aiArtist,
  shortcuts = false,
}: Props) {
  const router = useRouter()
  const [people, setPeople] = useState(initialPeople)
  const [projects, setProjects] = useState(initialProjects)
  const [role, setRole] = useState<PersonRole>(referenceType === "video" ? "director" : "photographer")

  const linkPerson = useCallback(
    async (body: { personId?: string; name?: string }, withRole: PersonRole) => {
      try {
        const person = await api<LinkedPerson>(`/api/references/${referenceId}/people`, {
          method: "POST",
          body: JSON.stringify({ ...body, role: withRole }),
        })
        setPeople((list) =>
          list.some((p) => p.id === person.id && p.role === person.role) ? list : [...list, person],
        )
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível vincular.")
      }
    },
    [referenceId, router],
  )

  async function unlinkPerson(p: LinkedPerson) {
    setPeople((list) => list.filter((x) => !(x.id === p.id && x.role === p.role)))
    try {
      await api(`/api/references/${referenceId}/people`, {
        method: "DELETE",
        body: JSON.stringify({ personId: p.id, role: p.role }),
      })
      router.refresh()
    } catch (error) {
      setPeople((list) => [...list, p])
      toast.error(error instanceof Error ? error.message : "Não foi possível remover.")
    }
  }

  const addToProject = useCallback(
    async (project: EntityOption) => {
      try {
        await api(`/api/projects/${project.id}/references`, {
          method: "POST",
          body: JSON.stringify({ referenceIds: [referenceId] }),
        })
        setProjects((list) => (list.some((p) => p.id === project.id) ? list : [...list, project]))
        toast.success(`Adicionada a “${project.name}”.`)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível adicionar ao projeto.")
      }
    },
    [referenceId, router],
  )

  async function createProjectAndAdd(name: string) {
    try {
      const project = await api<EntityOption>("/api/projects", { method: "POST", body: JSON.stringify({ name }) })
      await addToProject(project)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o projeto.")
    }
  }

  async function removeFromProject(project: LinkedProject) {
    setProjects((list) => list.filter((p) => p.id !== project.id))
    try {
      await api(`/api/projects/${project.id}/references`, {
        method: "DELETE",
        body: JSON.stringify({ referenceIds: [referenceId] }),
      })
      router.refresh()
    } catch (error) {
      setProjects((list) => [...list, project])
      toast.error(error instanceof Error ? error.message : "Não foi possível remover do projeto.")
    }
  }

  const inActive = activeProject ? projects.some((p) => p.id === activeProject.id) : true

  useEffect(() => {
    if (!shortcuts || !activeProject || inActive) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "p") return
      e.preventDefault()
      void addToProject(activeProject!)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeProject, addToProject, inActive, shortcuts])

  const aiName = aiArtist?.name?.trim()
  const aiLinked = aiName ? people.some((p) => p.name.toLowerCase() === aiName.toLowerCase()) : true

  return (
    <div className="flex flex-col gap-6">
      <div className="h-px bg-gradient-hairline" aria-hidden />

      <section className="flex flex-col gap-2.5" aria-label="Artistas">
        <h3 className="type-label text-muted-foreground">Artistas</h3>
        {people.length > 0 ? (
          <ul className="flex flex-col">
            {people.map((p) => (
              <li key={`${p.id}:${p.role}`} className="flex items-center gap-2 border-b py-2 last:border-b-0">
                <Link href={`/people/${p.id}`} className="text-sm hover:underline">
                  {p.name}
                </Link>
                <span className="type-label text-muted-foreground">{ROLE_LABEL[p.role]}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label={`Remover ${p.name}`}
                  onClick={() => void unlinkPerson(p)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {aiName && !aiLinked ? (
          <div className="flex items-center gap-2 text-sm">
            <SparklesIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {aiName} <span className="text-muted-foreground">· confiança {CONFIDENCE[aiArtist!.confidence]}</span>
            </span>
            <Button variant="outline" size="xs" onClick={() => void linkPerson({ name: aiName }, role)}>
              Vincular
            </Button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Select value={role} onValueChange={(v) => setRole(v as PersonRole)}>
            <SelectTrigger size="sm" className="w-36" aria-label="Papel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABEL) as PersonRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <EntityCombobox
            label="Artista"
            placeholder="Buscar ou criar artista"
            search={searchPeople}
            onSelect={(o) => void linkPerson({ personId: o.id }, role)}
            onCreate={(name) => void linkPerson({ name }, role)}
            createLabel={(name) => `Criar “${name}”`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2.5" aria-label="Projetos">
        <h3 className="type-label text-muted-foreground">Projetos</h3>
        {projects.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-1 border border-border-strong py-1 pr-1 pl-3">
                <Link href={`/projects/${p.id}`} className="type-label hover:underline">
                  {p.name}
                </Link>
                <button
                  type="button"
                  aria-label={`Remover de ${p.name}`}
                  onClick={() => void removeFromProject(p)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {activeProject && !inActive ? (
            <Button variant="secondary" size="xs" onClick={() => void addToProject(activeProject)}>
              <FolderPlusIcon /> {activeProject.name}
              {shortcuts ? <kbd className="ml-1 font-mono opacity-70">P</kbd> : null}
            </Button>
          ) : null}
          <EntityCombobox
            label="Projeto"
            placeholder="Buscar ou criar projeto"
            search={searchProjects}
            exclude={projects.map((p) => p.id)}
            onSelect={(o) => void addToProject(o)}
            onCreate={(name) => void createProjectAndAdd(name)}
            createLabel={(name) => `Criar projeto “${name}”`}
          />
        </div>
      </section>
    </div>
  )
}
