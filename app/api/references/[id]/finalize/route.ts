import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError, notFound, serverError, unauthorized } from "@/lib/api/responses"
import { headObject } from "@/lib/r2/presign"
import { ownsKey } from "@/lib/r2/keys"
import { createClient, getUserId } from "@/lib/supabase/server"

/** Verifies the uploaded objects exist in R2, then releases the item to the analysis queue. */
export async function POST(_request: Request, ctx: RouteContext<"/api/references/[id]/finalize">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  try {
    const { data: ref, error } = await supabase
      .from("references")
      .select("id, storage_key, thumbnail_key, frame_keys, file_size, media_ready")
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    if (!ref) return notFound()
    if (ref.media_ready) return NextResponse.json({ ok: true })

    const required = [ref.storage_key, ref.thumbnail_key, ...ref.frame_keys].filter((k): k is string => Boolean(k))
    if (required.some((k) => !ownsKey(userId, k))) return jsonError(403, "Acesso negado.")

    const heads = await Promise.all(required.map((k) => headObject(k)))
    const missing = required.filter((_, i) => !heads[i])
    if (missing.length > 0) return jsonError(409, "O envio ainda não terminou.", { missing: missing.length })

    const originalHead = heads[0]
    if (ref.storage_key && ref.file_size && originalHead && originalHead.size !== ref.file_size) {
      return jsonError(409, "O arquivo enviado não confere com o esperado.")
    }

    const { error: updateError } = await supabase
      .from("references")
      .update({ media_ready: true, status: "pending", analyzed_at: null })
      .eq("id", id)
    if (updateError) throw updateError

    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("references:finalize", error)
  }
}
