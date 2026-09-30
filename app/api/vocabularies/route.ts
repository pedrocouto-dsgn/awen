import { NextResponse } from "next/server"

import { invalid, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"
import { vocabTermSchema } from "@/lib/validation/reference"

/**
 * Adds a term to a vocabulary (e.g. accepting an AI "suggested new term").
 * If the term exists (case-insensitive), it is un-archived and returned instead.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = vocabTermSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  const { category, term } = parsed.data

  try {
    const { data: existing, error } = await supabase
      .from("vocabularies")
      .select("id, category, term, archived, sort_order")
      .eq("category", category)
      .ilike("term", term.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle()
    if (error) throw error

    if (existing) {
      if (!existing.archived) return NextResponse.json(existing)
      const { data, error: e } = await supabase
        .from("vocabularies")
        .update({ archived: false })
        .eq("id", existing.id)
        .select("id, category, term, archived, sort_order")
        .single()
      if (e) throw e
      return NextResponse.json(data)
    }

    const { data: last } = await supabase
      .from("vocabularies")
      .select("sort_order")
      .eq("category", category)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error: insertError } = await supabase
      .from("vocabularies")
      .insert({ category, term, sort_order: (last?.sort_order ?? 0) + 1 })
      .select("id, category, term, archived, sort_order")
      .single()
    if (insertError) throw insertError
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return serverError("vocabularies:create", error)
  }
}
