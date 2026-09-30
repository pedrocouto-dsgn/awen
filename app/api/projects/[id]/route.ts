import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, notFound, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"
import { projectUpdateSchema } from "@/lib/validation/entities"

export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = projectUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  const { is_active, ...fields } = parsed.data

  try {
    if (Object.keys(fields).length > 0) {
      const { data, error } = await supabase.from("projects").update(fields).eq("id", id).select("id")
      if (error) throw error
      if (!data?.length) return notFound()
    }
    if (is_active !== undefined) {
      // One active project at a time, switched atomically.
      const { error } = await supabase.rpc("set_active_project", { p_project_id: id, p_active: is_active })
      if (error) throw error
    }
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, is_active")
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    return data ? NextResponse.json(data) : notFound()
  } catch (error) {
    return serverError("projects:update", error)
  }
}

/** Deletes the project (references stay in the library). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()
  try {
    const { data, error } = await supabase.from("projects").delete().eq("id", id).select("id")
    if (error) throw error
    return data?.length ? NextResponse.json({ ok: true }) : notFound()
  } catch (error) {
    return serverError("projects:delete", error)
  }
}
