import { FolderIcon, LayoutDashboardIcon } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shell/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ProjectCardData } from "@/features/projects/projects-grid"

/** One moodboard per project: the cards open the board directly. */
export function MoodboardsGrid({ projects }: { projects: ProjectCardData[] }) {
  return (
    <div className="flex flex-col gap-8 px-4 pt-4 pb-8 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="type-display-lg">Moodboards</h1>
        <p className="text-muted-foreground">
          Cada projeto tem o seu board. As referências que entram no projeto aparecem nele automaticamente.
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          icon={LayoutDashboardIcon}
          title="Nenhum moodboard ainda"
          description="Crie um projeto e adicione referências a ele: o board do projeto aparece aqui."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects">
                <FolderIcon /> Ir para Projetos
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {projects.map((p) => (
            <li key={p.id} className="glass overflow-hidden rounded-2xl">
              <Link href={`/projects/${p.id}/board`} className="group flex flex-col">
                <div className="grid aspect-[16/10] grid-cols-3 grid-rows-2 gap-1 bg-media p-1">
                  {p.covers.length === 0 ? (
                    <div className="col-span-3 row-span-2 flex items-center justify-center text-media-foreground">
                      <LayoutDashboardIcon className="size-8" aria-hidden />
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
                            ? "col-span-3 row-span-2 size-full object-cover"
                            : i === 0
                              ? "col-span-2 row-span-2 size-full object-cover"
                              : p.covers.length === 2
                                ? "row-span-2 size-full object-cover"
                                : "size-full object-cover"
                        }
                      />
                    ))
                  )}
                </div>
                <div className="flex flex-col gap-1.5 p-6">
                  <div className="flex items-center gap-2">
                    <h2 className="type-title-md truncate">{p.name}</h2>
                    {p.isActive ? <Badge>Ativo</Badge> : null}
                  </div>
                  <p className="type-caption text-muted-foreground">
                    {p.count} {p.count === 1 ? "referência" : "referências"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
