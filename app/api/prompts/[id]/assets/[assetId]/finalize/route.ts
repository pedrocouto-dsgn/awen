import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError, serverError, unauthorized } from "@/lib/api/responses"
import { ownsKey } from "@/lib/r2/keys"
import { headObject } from "@/lib/r2/presign"
import { createClient, getUserId } from "@/lib/supabase/server"

/** Checks the uploaded file and preview exist in R2, then marks the asset ready. */
export async function POST(_request: Request, ctx: RouteContext<"/api/prompts/[id]/assets/[assetId]/finalize">) {
  const { id, assetId } = await ctx.params
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(assetId).success) {
    return jsonError(404, "Arquivo não encontrado.")
  }

  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  try {
    const { data: asset, error } = await supabase
      .from("prompt_assets")
      .select("storage_key, thumbnail_key, file_size, media_ready")
      .eq("id", assetId)
      .eq("prompt_id", id)
      .maybeSingle()
    if (error) throw error
    if (!asset) return jsonError(404, "Arquivo não encontrado.")
    if (asset.media_ready) return NextResponse.json({ ok: true })

    const required = [asset.storage_key, asset.thumbnail_key].filter((k): k is string => Boolean(k))
    if (required.some((k) => !ownsKey(userId, k))) return jsonError(403, "Acesso negado.")
    const heads = await Promise.all(required.map((k) => headObject(k)))
    if (heads.some((h) => !h)) return jsonError(409, "O envio ainda não terminou.")
    if (asset.file_size && heads[0] && heads[0].size !== asset.file_size) {
      return jsonError(409, "O arquivo enviado não confere com o esperado.")
    }

    const { error: updateError } = await supabase.from("prompt_assets").update({ media_ready: true }).eq("id", assetId)
    if (updateError) throw updateError
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("prompts:assets:finalize", error)
  }
}
