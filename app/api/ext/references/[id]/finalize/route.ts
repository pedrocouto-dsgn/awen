import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError, notFound, serverError } from "@/lib/api/responses"
import { finalizeImage } from "@/lib/ext/save"
import { authenticateToken } from "@/lib/ext/tokens"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60

/** Extension: the image is in R2; derive thumbnail and palette, then queue the analysis. */
export async function POST(request: Request, ctx: RouteContext<"/api/ext/references/[id]/finalize">) {
  const auth = await authenticateToken(request)
  if (!auth) return jsonError(401, "Token inválido ou revogado.")

  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()

  try {
    const result = await finalizeImage(createAdminClient(), auth.userId, id)
    if (!result.ok) return jsonError(result.status, result.error)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("ext:finalize", error)
  }
}
