import { ArrowLeftIcon, ImagesIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { EmptyState } from "@/components/shell/empty-state"
import { LibraryGrid } from "@/features/library/components/library-grid"
import { filtersToParams, parseFilters } from "@/lib/library/filters"
import { searchLibrary } from "@/lib/library/search"
import { createClient } from "@/lib/supabase/server"
import { ROLE_LABEL } from "@/lib/validation/entities"
import type { PersonRole } from "@/types/database"

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await createClient()
  const { data } = await supabase.from("people").select("id, name").eq("id", id).maybeSingle()
  return data ? { supabase, person: data } : null
}

export async function generateMetadata({ params }: PageProps<"/people/[id]">): Promise<Metadata> {
  return { title: (await load((await params).id))?.person.name ?? "Pessoa" }
}

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const found = await load((await params).id)
  if (!found) notFound()
  const { supabase, person } = found

  const filters = parseFilters({ pessoa: person.id })
  const [result, roles, pending] = await Promise.all([
    searchLibrary(supabase, filters),
    supabase.from("reference_people").select("role").eq("person_id", person.id),
    supabase
      .from("reference_people")
      .select("reference_id, references!inner(status)", { count: "exact", head: true })
      .eq("person_id", person.id)
      .neq("references.status", "approved"),
  ])
  const roleLabels = [...new Set((roles.data ?? []).map((r) => r.role as PersonRole))].map((r) => ROLE_LABEL[r])

  return (
    <div className="flex flex-col gap-8 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-3">
        <Link href="/people" className="type-nav flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden /> Pessoas
        </Link>
        <h1 className="type-display-lg">{person.name}</h1>
        <p className="text-muted-foreground">
          {result.total} {result.total === 1 ? "referência na biblioteca" : "referências na biblioteca"}
          {roleLabels.length ? ` · ${roleLabels.join(", ")}` : ""}
          {pending.count ? ` · ${pending.count} ainda fora da biblioteca` : ""}
        </p>
      </header>
      {result.cards.length > 0 ? (
        <LibraryGrid
          initialCards={result.cards}
          initialNextOffset={result.nextOffset}
          total={result.total}
          query={filtersToParams(filters).toString()}
        />
      ) : (
        <EmptyState
          icon={ImagesIcon}
          title="Nenhuma referência aprovada"
          description="As referências desta pessoa aparecem aqui depois de aprovadas na revisão."
        />
      )}
    </div>
  )
}
