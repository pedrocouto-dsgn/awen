import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, jsonError, notFound, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"
import { personUpdateSchema } from "@/lib/validation/entities"

export async function PATCH(request: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = personUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    const { data, error } = await supabase
      .from("people")
      .update({ name: parsed.data.name })
      .eq("id", id)
      .select("id, name")
      .maybeSingle()
    if (error) {
      if (error.code === "23505") return jsonError(409, "Já existe uma pessoa com esse nome.")
      throw error
    }
    return data ? NextResponse.json(data) : notFound()
  } catch (error) {
    return serverError("people:update", error)
  }
}

/** Deletes the person and their links (references are kept). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()
  try {
    const { data, error } = await supabase.from("people").delete().eq("id", id).select("id")
    if (error) throw error
    return data?.length ? NextResponse.json({ ok: true }) : notFound()
  } catch (error) {
    return serverError("people:delete", error)
  }
}
