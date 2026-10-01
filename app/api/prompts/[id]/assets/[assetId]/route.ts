import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError, serverError, unauthorized } from "@/lib/api/responses"
import { keys } from "@/lib/r2/keys"
import { deletePrefix } from "@/lib/r2/presign"
import { createClient, getUserId } from "@/lib/supabase/server"

/** Removes a result or input (and its files, when it is not a reference). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/prompts/[id]/assets/[assetId]">) {
  const { id, assetId } = await ctx.params
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(assetId).success) {
    return jsonError(404, "Arquivo não encontrado.")
  }

  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  try {
    const { data, error } = await supabase
      .from("prompt_assets")
      .delete()
      .eq("id", assetId)
      .eq("prompt_id", id)
      .select("storage_key")
      .maybeSingle()
    if (error) throw error
    if (!data) return jsonError(404, "Arquivo não encontrado.")
    // The file and its preview share the asset id as prefix.
    if (data.storage_key) await deletePrefix(`${keys.promptPrefix(userId, id)}${assetId}`).catch(() => undefined)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("prompts:assets:delete", error)
  }
}
