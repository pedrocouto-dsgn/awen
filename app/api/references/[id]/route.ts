import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, jsonError, notFound, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { keys } from "@/lib/r2/keys"
import { deletePrefix } from "@/lib/r2/presign"
import { createClient, getUserId } from "@/lib/supabase/server"
import { referenceUpdateSchema } from "@/lib/validation/reference"
import type { TablesUpdate, VocabCategory } from "@/types/database"

const VOCAB_FIELDS = ["shot_type", "camera_angle", "camera_movement", "lighting", "mood"] as const

/** Edits curated fields and/or reviews (approve / reject / back to pending). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/references/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = referenceUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  const input = parsed.data

  try {
    const { data: current, error } = await supabase.from("references").select("id, status").eq("id", id).maybeSingle()
    if (error) throw error
    if (!current) return notFound()
    if (current.status === "analyzing" && input.status) {
      return jsonError(409, "Esta referência ainda está sendo analisada.")
    }

    // Vocabulary fields must use terms from the user's vocabularies (archived terms allowed).
    const used = VOCAB_FIELDS.flatMap((field) => {
      const v = input[field]
      const values = Array.isArray(v) ? v : v ? [v] : []
      return values.map((term) => ({ category: field as VocabCategory, term }))
    })
    if (used.length > 0) {
      const { data: vocab, error: vocabError } = await supabase
        .from("vocabularies")
        .select("category, term")
        .in("category", [...new Set(used.map((u) => u.category))])
      if (vocabError) throw vocabError
      const known = new Set((vocab ?? []).map((v) => `${v.category}:${v.term}`))
      const unknown = used.filter((u) => !known.has(`${u.category}:${u.term}`))
      if (unknown.length > 0) {
        return jsonError(400, "Termo fora do vocabulário.", unknown)
      }
    }

    const update: TablesUpdate<"references"> = { ...input }
    if (input.status === "approved" || input.status === "rejected") update.reviewed_at = new Date().toISOString()
    if (input.status === "pending") update.reviewed_at = null

    const { data, error: updateError } = await supabase
      .from("references")
      .update(update)
      .eq("id", id)
      .select("id, status, reviewed_at")
      .single()
    if (updateError) throw updateError
    return NextResponse.json(data)
  } catch (error) {
    return serverError("references:update", error)
  }
}

/** Deletes a reference and all of its files in R2. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/references/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  try {
    const { data, error } = await supabase.from("references").delete().eq("id", id).select("id")
    if (error) throw error
    if (!data || data.length === 0) return notFound()

    await deletePrefix(keys.prefix(userId, id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("references:delete", error)
  }
}
