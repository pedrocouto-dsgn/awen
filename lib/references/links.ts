import "server-only"

import type { ServerSupabase } from "@/lib/supabase/server"
import type { PersonRole } from "@/types/database"

export type LinkedPerson = { id: string; name: string; role: PersonRole }
export type LinkedProject = { id: string; name: string }
export type ReferenceLinksData = { people: LinkedPerson[]; projects: LinkedProject[] }
export type ActiveProject = { id: string; name: string } | null

/** People and projects for many references at once (two queries). */
export async function loadLinks(supabase: ServerSupabase, ids: string[]): Promise<Map<string, ReferenceLinksData>> {
  const map = new Map<string, ReferenceLinksData>(ids.map((id) => [id, { people: [], projects: [] }]))
  if (ids.length === 0) return map

  const [people, projects] = await Promise.all([
    supabase.from("reference_people").select("reference_id, role, people(id, name)").in("reference_id", ids),
    supabase.from("project_references").select("reference_id, projects(id, name)").in("reference_id", ids),
  ])
  if (people.error) throw people.error
  if (projects.error) throw projects.error

  for (const row of people.data ?? []) {
    const p = row.people as unknown as { id: string; name: string } | null
    if (p) map.get(row.reference_id)?.people.push({ id: p.id, name: p.name, role: row.role })
  }
  for (const row of projects.data ?? []) {
    const p = row.projects as unknown as { id: string; name: string } | null
    if (p) map.get(row.reference_id)?.projects.push({ id: p.id, name: p.name })
  }
  for (const links of map.values()) {
    links.people.sort((a, b) => a.name.localeCompare(b.name))
    links.projects.sort((a, b) => a.name.localeCompare(b.name))
  }
  return map
}

export async function getActiveProject(supabase: ServerSupabase): Promise<ActiveProject> {
  const { data } = await supabase.from("projects").select("id, name").eq("is_active", true).maybeSingle()
  return data ?? null
}
