import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { ReferenceDetail } from "@/features/library/components/reference-detail"
import { LinkedPrompts } from "@/features/prompts/linked-prompts"
import { ReferenceLinks } from "@/features/references/reference-links"
import { promptsForReference } from "@/lib/prompts/data"
import { getActiveProject, loadLinks } from "@/lib/references/links"
import { toReferenceView } from "@/lib/references/view"
import { getVocabularies } from "@/lib/references/vocab"
import { createClient } from "@/lib/supabase/server"

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await createClient()
  const { data } = await supabase.from("references").select("*").eq("id", id).maybeSingle()
  return data ? { supabase, ref: data } : null
}

export async function generateMetadata({ params }: PageProps<"/library/[id]">): Promise<Metadata> {
  const found = await load((await params).id)
  return { title: found?.ref.title ?? "Referência" }
}

export default async function ReferencePage({ params }: PageProps<"/library/[id]">) {
  const found = await load((await params).id)
  if (!found) notFound()

  const [view, vocab, links, activeProject, prompts] = await Promise.all([
    toReferenceView(found.ref),
    getVocabularies(found.supabase),
    loadLinks(found.supabase, [found.ref.id]),
    getActiveProject(found.supabase),
    promptsForReference(found.supabase, found.ref.id),
  ])
  const own = links.get(view.id) ?? { people: [], projects: [] }
  return (
    // Full-height screen on large displays: the breadcrumb on top, the detail fills the rest.
    <div className="flex flex-1 flex-col lg:h-svh lg:flex-none lg:overflow-hidden">
      <PageBreadcrumb items={[{ label: "Biblioteca", href: "/library" }, { label: view.title ?? "Sem título" }]} />
      <ReferenceDetail key={view.id} reference={view} vocab={vocab}>
        <ReferenceLinks
          referenceId={view.id}
          referenceType={view.type}
          initialPeople={own.people}
          initialProjects={own.projects}
          activeProject={activeProject}
          aiArtist={view.ai?.artist ?? null}
          shortcuts
        />
        <LinkedPrompts prompts={prompts} referenceId={view.id} />
      </ReferenceDetail>
    </div>
  )
}
