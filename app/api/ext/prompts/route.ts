import { NextResponse } from "next/server"

import { invalid, jsonError, readJson, serverError } from "@/lib/api/responses"
import { createPromptWithImage } from "@/lib/ext/prompts"
import { authenticateToken } from "@/lib/ext/tokens"
import { createAdminClient } from "@/lib/supabase/admin"
import { extPromptSchema, type ExtPromptResponse } from "@/lib/validation/ext"

/**
 * Extension "Salvar como resultado do prompt": creates the prompt with a presigned
 * upload for its result image, finished by /api/ext/prompts/:id/assets/:assetId/finalize.
 */
export async function POST(request: Request) {
  const auth = await authenticateToken(request)
  if (!auth) return jsonError(401, "Token inválido ou revogado.")

  const parsed = extPromptSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)

  try {
    const created = await createPromptWithImage(createAdminClient(), auth.userId, parsed.data)
    return NextResponse.json<ExtPromptResponse>(created)
  } catch (error) {
    return serverError("ext:prompts", error)
  }
}
