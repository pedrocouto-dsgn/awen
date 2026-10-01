import { ScrollTextIcon, SearchXIcon } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shell/empty-state"
import { PromptGrid } from "@/features/prompts/prompt-grid"
import { PromptToolbar } from "@/features/prompts/prompt-toolbar"
import { searchPrompts, toolSuggestions } from "@/lib/prompts/data"
import { countPromptFilters, parsePromptFilters, promptFiltersToParams } from "@/lib/prompts/options"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Prompts" }

export default async function PromptsPage({ searchParams }: PageProps<"/prompts">) {
  const filters = parsePromptFilters(await searchParams)
  const supabase = await createClient()

  const [result, names, projects] = await Promise.all([
    searchPrompts(supabase, filters),
    toolSuggestions(supabase),
    supabase.from("projects").select("id, name").order("name"),
  ])
  const query = promptFiltersToParams(filters).toString()
  const filtering = Boolean(filters.q || countPromptFilters(filters) > 0)
  const templates = filters.aba === "modelos"

  return (
    <div className="flex flex-col gap-5 px-3 py-4 md:px-5 md:py-5">
      <PromptToolbar
        filters={filters}
        options={{ tools: names.tools, models: names.models, projects: projects.data ?? [] }}
        total={result.total}
      />
      {result.cards.length > 0 ? (
        <PromptGrid
          key={query}
          initialCards={result.cards}
          initialNextOffset={result.nextOffset}
          total={result.total}
          query={query}
        />
      ) : filtering ? (
        <EmptyState icon={SearchXIcon} title="Nada encontrado" description="Nenhum prompt combina com esta busca. Tente tirar algum filtro." />
      ) : templates ? (
        <EmptyState
          icon={ScrollTextIcon}
          title="Nenhum modelo ainda"
          description="Um modelo é um prompt com campos como {subject} e {location}, para reutilizar a estrutura trocando só o conteúdo."
        />
      ) : (
        <EmptyState
          icon={ScrollTextIcon}
          title="Nenhum prompt ainda"
          description="Guarde aqui os prompts que funcionaram (seus ou de terceiros), sempre junto com o resultado que geraram."
        />
      )}
    </div>
  )
}
