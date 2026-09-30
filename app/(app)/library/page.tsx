import { ImagesIcon, SearchXIcon } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shell/empty-state"
import { LibraryGrid } from "@/features/library/components/library-grid"
import { LibraryToolbar, type FilterOptions } from "@/features/library/components/library-toolbar"
import { countActiveFilters, filtersToParams, parseFilters } from "@/lib/library/filters"
import { searchLibrary } from "@/lib/library/search"
import { getActiveProject } from "@/lib/references/links"
import { getVocabularies } from "@/lib/references/vocab"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Biblioteca" }

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const filters = parseFilters(await searchParams)
  const supabase = await createClient()

  const [result, vocab, people, projects, activeProject] = await Promise.all([
    searchLibrary(supabase, filters),
    getVocabularies(supabase),
    supabase.from("people").select("id, name").order("name"),
    supabase.from("projects").select("id, name").order("name"),
    getActiveProject(supabase),
  ])

  const active = (list: { term: string; archived: boolean }[]) => list.filter((t) => !t.archived).map((t) => t.term)
  const options: FilterOptions = {
    shotTypes: active(vocab.shot_type),
    moods: active(vocab.mood),
    lighting: active(vocab.lighting),
    people: people.data ?? [],
    projects: projects.data ?? [],
  }
  const query = filtersToParams(filters).toString()
  const filtering = Boolean(filters.q || filters.cor || countActiveFilters(filters) > 0)

  return (
    <div className="flex flex-col gap-5 px-3 py-4 md:px-5 md:py-5">
      <LibraryToolbar filters={filters} options={options} total={result.total} />
      {result.cards.length > 0 ? (
        <LibraryGrid
          key={query}
          initialCards={result.cards}
          initialNextOffset={result.nextOffset}
          total={result.total}
          query={query}
          activeProject={activeProject}
        />
      ) : filtering ? (
        <EmptyState
          icon={SearchXIcon}
          title="Nada encontrado"
          description="Nenhuma referência aprovada combina com esta busca. Tente tirar algum filtro."
        />
      ) : (
        <EmptyState
          icon={ImagesIcon}
          title="Nenhuma referência aprovada ainda"
          description="Adicione imagens, vídeos ou links. Depois da análise e da revisão, eles aparecem aqui."
        />
      )}
    </div>
  )
}
