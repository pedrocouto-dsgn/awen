import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, notFound, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"
import { projectItemsSchema } from "@/lib/validation/entities"

/** Adds references to a project. The same reference can be in several projects. */
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/references">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = projectItemsSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    // Canvas fields (x, y, width, height) stay null until the moodboard exists.
    const { error } = await supabase.from("project_references").upsert(
      parsed.data.referenceIds.map((reference_id) => ({ project_id: id, reference_id })),
      { onConflict: "project_id,reference_id", ignoreDuplicates: true },
    )
    if (error) {
      if (error.code === "42501" || error.code === "23503") return notFound()
      throw error
    }
    await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", id)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return serverError("projects:references:add", error)
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/projects/[id]/references">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = projectItemsSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    const { error } = await supabase
      .from("project_references")
      .delete()
      .eq("project_id", id)
      .in("reference_id", parsed.data.referenceIds)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("projects:references:remove", error)
  }
}
