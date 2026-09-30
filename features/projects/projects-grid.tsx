"use client"

import { FolderIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, StarIcon, StarOffIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shell/confirm-dialog"
import { EmptyState } from "@/components/shell/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { deleteProject, setProjectActive } from "./project-actions"
import { ProjectFormDialog } from "./project-form-dialog"

export type ProjectCardData = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  count: number
  covers: string[]
}

export function ProjectsGrid({ projects }: { projects: ProjectCardData[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ProjectCardData | null>(null)
  const [deleting, setDeleting] = useState<ProjectCardData | null>(null)

  async function toggleActive(p: ProjectCardData) {
    try {
      await setProjectActive(p.id, !p.isActive)
      toast.success(p.isActive ? "Nenhum projeto ativo." : `“${p.name}” agora é o projeto ativo.`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro.")
    }
  }

  return (
    <div className="flex flex-col gap-8 px-4 pt-4 pb-8 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="type-display-lg">Projetos</h1>
          <p className="text-muted-foreground">
            Agrupe referências. Uma referência pode estar em vários projetos. O projeto ativo aparece no topo e aceita
            a tecla P na revisão.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon /> Novo projeto
        </Button>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderIcon}
          title="Nenhum projeto ainda"
          description="Crie um projeto e adicione referências a ele pela revisão ou pelo detalhe."
          action={
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              <PlusIcon /> Criar projeto
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {projects.map((p) => (
            <li key={p.id} className="glass group relative flex flex-col overflow-hidden rounded-2xl">
              <Link href={`/projects/${p.id}`} className="flex flex-col">
                <div className="grid aspect-[16/10] grid-cols-2 grid-rows-2 gap-px bg-media">
                  {p.covers.length === 0 ? (
                    <div className="col-span-2 row-span-2 flex items-center justify-center text-media-foreground">
                      <FolderIcon className="size-8" aria-hidden />
                    </div>
                  ) : (
                    p.covers.slice(0, 4).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
                      <img
                        key={src}
                        src={src}
                        alt=""
                        loading="lazy"
                        className={
                          p.covers.length === 1
                            ? "col-span-2 row-span-2 size-full object-cover"
                            : p.covers.length === 2
                              ? "row-span-2 size-full object-cover"
                              : p.covers.length === 3 && i === 0
                                ? "row-span-2 size-full object-cover"
                                : "size-full object-cover"
                        }
                      />
                    ))
                  )}
                </div>
                <div className="flex flex-col gap-1.5 p-6 pr-14">
                  <div className="flex items-center gap-2">
                    <h2 className="type-title-md truncate">{p.name}</h2>
                    {p.isActive ? <Badge>Ativo</Badge> : null}
                  </div>
                  {p.description ? <p className="line-clamp-2 text-muted-foreground">{p.description}</p> : null}
                  <p className="type-caption text-muted-foreground">
                    {p.count} {p.count === 1 ? "referência" : "referências"}
                  </p>
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="absolute right-3 bottom-5" aria-label={`Ações de ${p.name}`}>
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void toggleActive(p)}>
                    {p.isActive ? <StarOffIcon /> : <StarIcon />} {p.isActive ? "Desativar" : "Definir como ativo"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditing(p)}>
                    <PencilIcon /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
                    <Trash2Icon /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <ProjectFormDialog
          open
          onOpenChange={setCreating}
          onSaved={(project) => {
            toast.success(`Projeto “${project.name}” criado.`)
            router.push(`/projects/${project.id}`)
          }}
        />
      ) : null}
      {editing ? (
        <ProjectFormDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          initial={editing}
          onSaved={() => router.refresh()}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir projeto?"
        description={`O projeto “${deleting?.name ?? ""}” será apagado. As referências continuam na biblioteca.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await deleteProject(deleting.id)
            router.refresh()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro.")
          }
        }}
      />
    </div>
  )
}
