import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { BoardEditor } from "@/features/board/board-editor"
import { getBoard } from "@/lib/board/data"
import { createClient } from "@/lib/supabase/server"

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await createClient()
  const { data } = await supabase.from("projects").select("id, name").eq("id", id).maybeSingle()
  return data ? { supabase, project: data } : null
}

export async function generateMetadata({ params }: PageProps<"/projects/[id]/board">): Promise<Metadata> {
  const found = await load((await params).id)
  return { title: found ? `Moodboard · ${found.project.name}` : "Moodboard" }
}

export default async function BoardPage({ params }: PageProps<"/projects/[id]/board">) {
  const found = await load((await params).id)
  if (!found) notFound()
  const { supabase, project } = found
  const board = await getBoard(supabase, project.id)

  return (
    // Fills the viewport: the board scrolls inside, the toolbar stays put.
    <div className="flex h-svh flex-col overflow-hidden">
      <PageBreadcrumb
        items={[
          { label: "Projetos", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Moodboard" },
        ]}
      />
      <BoardEditor key={project.id} project={project} initialItems={board.items} placedNow={board.placedNow} />
    </div>
  )
}
