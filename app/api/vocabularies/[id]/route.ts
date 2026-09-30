import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, jsonError, notFound, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"
import { vocabTermUpdateSchema } from "@/lib/validation/reference"

/**
 * Renames (cascading to references that use the term) and/or archives a term.
 * Archived terms leave the AI vocabulary and pickers but stay on existing references.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/vocabularies/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = vocabTermUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)

  try {
    if (parsed.data.term !== undefined) {
      const { error } = await supabase.rpc("rename_vocab_term", { p_id: id, p_term: parsed.data.term })
      if (error) {
        if (error.code === "23505") return jsonError(409, "Já existe um termo com esse nome nesta categoria.")
        if (error.code === "P0002") return notFound()
        if (error.code === "PGRST202") {
          return jsonError(500, "Aplique a migration 20260930000004_vocabulary_admin.sql no Supabase.")
        }
        throw error
      }
    }
    if (parsed.data.archived !== undefined) {
      const { data, error } = await supabase
        .from("vocabularies")
        .update({ archived: parsed.data.archived })
        .eq("id", id)
        .select("id")
      if (error) throw error
      if (!data?.length) return notFound()
    }
    const { data, error } = await supabase
      .from("vocabularies")
      .select("id, category, term, archived, sort_order")
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    return data ? NextResponse.json(data) : notFound()
  } catch (error) {
    return serverError("vocabularies:update", error)
  }
}
