import "server-only"

import type { ServerSupabase } from "@/lib/supabase/server"

/** Finds a person by name (case-insensitive) or creates it. */
export async function findOrCreatePerson(supabase: ServerSupabase, name: string) {
  const escaped = name.replace(/[%_\\]/g, "\\$&")
  const { data: existing, error } = await supabase
    .from("people")
    .select("id, name")
    .ilike("name", escaped)
    .maybeSingle()
  if (error) throw error
  if (existing) return existing
  const { data, error: insertError } = await supabase.from("people").insert({ name }).select("id, name").single()
  if (insertError) throw insertError
  return data
}
