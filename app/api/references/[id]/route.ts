import { NextResponse } from "next/server"
import { z } from "zod"

import { notFound, serverError, unauthorized } from "@/lib/api/responses"
import { keys } from "@/lib/r2/keys"
import { deletePrefix } from "@/lib/r2/presign"
import { createClient, getUserId } from "@/lib/supabase/server"

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
