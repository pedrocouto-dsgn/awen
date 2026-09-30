import type { Metadata } from "next"

import { ProjectsGrid, type ProjectCardData } from "@/features/projects/projects-grid"
import { presignGet } from "@/lib/r2/presign"
import { VIEW_TTL_SECONDS } from "@/lib/references/view"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Projetos" }

export default async function ProjectsPage() {
  const supabase = await createClient()
  const [projects, items] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, is_active, updated_at")
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("project_references")
      .select("project_id, created_at, references!inner(thumbnail_key, status)")
      .eq("references.status", "approved")
      .order("created_at", { ascending: false }),
  ])
  if (projects.error) throw projects.error
  if (items.error) throw items.error

  const byProject = new Map<string, { count: number; keys: string[] }>()
  for (const row of items.data ?? []) {
    const ref = row.references as unknown as { thumbnail_key: string | null }
    const entry = byProject.get(row.project_id) ?? { count: 0, keys: [] }
    entry.count += 1
    if (ref.thumbnail_key && entry.keys.length < 4) entry.keys.push(ref.thumbnail_key)
    byProject.set(row.project_id, entry)
  }

  const cards: ProjectCardData[] = await Promise.all(
    (projects.data ?? []).map(async (p) => {
      const entry = byProject.get(p.id)
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        isActive: p.is_active,
        count: entry?.count ?? 0,
        covers: await Promise.all((entry?.keys ?? []).map((k) => presignGet(k, VIEW_TTL_SECONDS))),
      }
    }),
  )

  return <ProjectsGrid projects={cards} />
}
