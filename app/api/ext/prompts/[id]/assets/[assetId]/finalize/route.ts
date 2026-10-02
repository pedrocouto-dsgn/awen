import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError, serverError } from "@/lib/api/responses"
import { finalizePromptImage } from "@/lib/ext/prompts"
import { authenticateToken } from "@/lib/ext/tokens"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60

/** Extension: the result image is in R2; derive its preview and palette. */
export async function POST(request: Request, ctx: RouteContext<"/api/ext/prompts/[id]/assets/[assetId]/finalize">) {
  const auth = await authenticateToken(request)
  if (!auth) return jsonError(401, "Token inválido ou revogado.")

  const { id, assetId } = await ctx.params
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(assetId).success) {
    return jsonError(404, "Prompt não encontrado.")
  }

  try {
    const result = await finalizePromptImage(createAdminClient(), auth.userId, id, assetId)
    if (!result.ok) return jsonError(result.status, result.error)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("ext:prompts:finalize", error)
  }
}
