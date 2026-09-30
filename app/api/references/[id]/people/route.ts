import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, notFound, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { findOrCreatePerson } from "@/lib/people"
import { createClient, getUserId } from "@/lib/supabase/server"
import { referencePersonLinkSchema, referencePersonUnlinkSchema } from "@/lib/validation/entities"

/** Links a person (existing or created by name) to a reference with a role. */
export async function POST(request: Request, ctx: RouteContext<"/api/references/[id]/people">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = referencePersonLinkSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)

  try {
    let person: { id: string; name: string } | null
    if (parsed.data.personId) {
      const { data, error } = await supabase
        .from("people")
        .select("id, name")
        .eq("id", parsed.data.personId)
        .maybeSingle()
      if (error) throw error
      person = data
    } else {
      person = await findOrCreatePerson(supabase, parsed.data.name!)
    }
    if (!person) return notFound()

    const { error } = await supabase
      .from("reference_people")
      .upsert(
        { reference_id: id, person_id: person.id, role: parsed.data.role },
        { onConflict: "reference_id,person_id,role", ignoreDuplicates: true },
      )
    if (error) {
      // RLS rejects links to references the user does not own.
      if (error.code === "42501" || error.code === "23503") return notFound()
      throw error
    }
    return NextResponse.json({ id: person.id, name: person.name, role: parsed.data.role }, { status: 201 })
  } catch (error) {
    return serverError("references:people:link", error)
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/references/[id]/people">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = referencePersonUnlinkSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    const { error } = await supabase
      .from("reference_people")
      .delete()
      .eq("reference_id", id)
      .eq("person_id", parsed.data.personId)
      .eq("role", parsed.data.role)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("references:people:unlink", error)
  }
}
