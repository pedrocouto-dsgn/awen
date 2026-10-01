import { FolderOpenIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { EmptyState } from "@/components/shell/empty-state"
import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { LibraryGrid } from "@/features/library/components/library-grid"
import { ProjectHeader } from "@/features/projects/project-header"
import { PromptGrid } from "@/features/prompts/prompt-grid"
import { filtersToParams, parseFilters } from "@/lib/library/filters"
import { searchLibrary } from "@/lib/library/search"
import { promptsForProject } from "@/lib/prompts/data"
import { createClient } from "@/lib/supabase/server"

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("projects")
    .select("id, name, description, is_active")
    .eq("id", id)
    .maybeSingle()
  return data ? { supabase, project: data } : null
}

export async function generateMetadata({ params }: PageProps<"/projects/[id]">): Promise<Metadata> {
  return { title: (await load((await params).id))?.project.name ?? "Projeto" }
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const found = await load((await params).id)
  if (!found) notFound()
  const { supabase, project } = found

  const filters = parseFilters({ projeto: project.id })
  const [result, prompts] = await Promise.all([searchLibrary(supabase, filters), promptsForProject(supabase, project.id)])

  return (
    <>
      <PageBreadcrumb items={[{ label: "Projetos", href: "/projects" }, { label: project.name }]} />
      <div className="flex flex-col gap-8 px-4 pt-4 pb-8 md:px-8">
        <ProjectHeader project={project} total={result.total} />
        {result.cards.length > 0 ? (
          <LibraryGrid
            key={project.id}
            initialCards={result.cards}
            initialNextOffset={result.nextOffset}
            total={result.total}
            query={filtersToParams(filters).toString()}
            projectId={project.id}
          />
        ) : (
          <EmptyState
            icon={FolderOpenIcon}
            title="Projeto vazio"
            description={
              project.is_active
                ? "Na revisão ou no detalhe de uma referência, aperte P para adicioná-la a este projeto."
                : "Adicione referências pela seção Projetos no detalhe ou na revisão."
            }
          />
        )}
        {prompts.length > 0 ? (
          <section className="flex flex-col gap-4" aria-label="Prompts usados">
            <h2 className="type-label text-muted-foreground">Prompts usados · {prompts.length}</h2>
            <PromptGrid initialCards={prompts} />
          </section>
        ) : null}
      </div>
    </>
  )
}
