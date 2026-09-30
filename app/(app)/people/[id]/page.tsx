import { ImagesIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { EmptyState } from "@/components/shell/empty-state"
import { LibraryGrid } from "@/features/library/components/library-grid"
import { ArtistBanner } from "@/features/people/artist-banner"
import { filtersToParams, parseFilters } from "@/lib/library/filters"
import { presignGet } from "@/lib/r2/presign"
import { getActiveProject } from "@/lib/references/links"
import { searchLibrary } from "@/lib/library/search"
import { createClient } from "@/lib/supabase/server"
import { ROLE_LABEL } from "@/lib/validation/entities"
import type { PersonRole } from "@/types/database"

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await createClient()
  const { data } = await supabase.from("people").select("id, name, photo_key").eq("id", id).maybeSingle()
  return data ? { supabase, person: data } : null
}

export async function generateMetadata({ params }: PageProps<"/people/[id]">): Promise<Metadata> {
  return { title: (await load((await params).id))?.person.name ?? "Artista" }
}

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const found = await load((await params).id)
  if (!found) notFound()
  const { supabase, person } = found

  const filters = parseFilters({ pessoa: person.id })
  const [result, roles, pending, photoUrl, activeProject] = await Promise.all([
    searchLibrary(supabase, filters),
    supabase.from("reference_people").select("role").eq("person_id", person.id),
    supabase
      .from("reference_people")
      .select("reference_id, references!inner(status)", { count: "exact", head: true })
      .eq("person_id", person.id)
      .neq("references.status", "approved"),
    person.photo_key ? presignGet(person.photo_key, 60 * 60).catch(() => null) : null,
    getActiveProject(supabase),
  ])
  const roleLabels = [...new Set((roles.data ?? []).map((r) => r.role as PersonRole))].map((r) => ROLE_LABEL[r])

  return (
    <>
      <PageBreadcrumb items={[{ label: "Artistas", href: "/people" }, { label: person.name }]} />
      <div className="flex flex-col gap-6 px-3 pb-3 md:gap-8">
        <ArtistBanner
          person={{ id: person.id, name: person.name }}
          photoUrl={photoUrl}
          subtitle={[
            `${result.total} ${result.total === 1 ? "referência na biblioteca" : "referências na biblioteca"}`,
            roleLabels.join(", "),
            pending.count ? `${pending.count} ainda fora da biblioteca` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        {result.cards.length > 0 ? (
          <LibraryGrid
            initialCards={result.cards}
            initialNextOffset={result.nextOffset}
            total={result.total}
            query={filtersToParams(filters).toString()}
            activeProject={activeProject}
          />
        ) : (
          <EmptyState
            icon={ImagesIcon}
            title="Nenhuma referência aprovada"
            description="As referências deste artista aparecem aqui depois de aprovadas na revisão."
          />
        )}
      </div>
    </>
  )
}
