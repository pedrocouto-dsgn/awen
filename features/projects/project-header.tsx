"use client"

import { ArrowLeftIcon, PencilIcon, StarIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shell/confirm-dialog"
import { Button } from "@/components/ui/button"

import { deleteProject, setProjectActive } from "./project-actions"
import { ProjectFormDialog } from "./project-form-dialog"

type Project = { id: string; name: string; description: string | null; is_active: boolean }

export function ProjectHeader({ project, total }: { project: Project; total: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <header className="flex flex-col gap-3">
      <Link href="/projects" className="type-nav flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> Projetos
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="type-display-lg break-words">{project.name}</h1>
          {project.description ? <p className="max-w-2xl text-muted-foreground">{project.description}</p> : null}
          <p className="type-caption text-muted-foreground">
            {total} {total === 1 ? "referência" : "referências"} na biblioteca
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={project.is_active ? "secondary" : "outline"}
            size="sm"
            aria-pressed={project.is_active}
            onClick={async () => {
              try {
                await setProjectActive(project.id, !project.is_active)
                router.refresh()
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Erro.")
              }
            }}
          >
            <StarIcon className={project.is_active ? "fill-current" : undefined} />
            {project.is_active ? "Projeto ativo" : "Definir como ativo"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon /> Editar
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
            <Trash2Icon /> Excluir
          </Button>
        </div>
      </div>
      {editing ? (
        <ProjectFormDialog open onOpenChange={setEditing} initial={project} onSaved={() => router.refresh()} />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir projeto?"
        description={`O projeto “${project.name}” será apagado. As referências continuam na biblioteca.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          try {
            await deleteProject(project.id)
            router.push("/projects")
            router.refresh()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro.")
          }
        }}
      />
    </header>
  )
}
