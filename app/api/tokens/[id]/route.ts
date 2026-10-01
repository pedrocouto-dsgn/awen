import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"

/** Revokes a personal token: the extension using it stops working immediately. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/tokens/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Token não encontrado.")

  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  try {
    const { data, error } = await supabase.from("api_tokens").delete().eq("id", id).select("id")
    if (error) throw error
    if (!data || data.length === 0) return jsonError(404, "Token não encontrado.")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("tokens:delete", error)
  }
}
