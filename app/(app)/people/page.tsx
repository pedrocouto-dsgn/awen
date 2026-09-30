import type { Metadata } from "next"

import { PeopleList, type PersonRow } from "@/features/people/people-list"
import { createClient } from "@/lib/supabase/server"
import type { PersonRole } from "@/types/database"

export const metadata: Metadata = { title: "Pessoas" }

export default async function PeoplePage() {
  const supabase = await createClient()
  const [people, links] = await Promise.all([
    supabase.from("people").select("id, name").order("name"),
    supabase.from("reference_people").select("person_id, reference_id, role"),
  ])
  if (people.error) throw people.error
  if (links.error) throw links.error

  const stats = new Map<string, { refs: Set<string>; roles: Set<PersonRole> }>()
  for (const l of links.data ?? []) {
    const s = stats.get(l.person_id) ?? { refs: new Set(), roles: new Set() }
    s.refs.add(l.reference_id)
    s.roles.add(l.role)
    stats.set(l.person_id, s)
  }

  const rows: PersonRow[] = (people.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    count: stats.get(p.id)?.refs.size ?? 0,
    roles: [...(stats.get(p.id)?.roles ?? [])],
  }))

  return <PeopleList people={rows} />
}
