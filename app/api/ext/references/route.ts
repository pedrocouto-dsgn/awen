import { NextResponse } from "next/server"

import { invalid, jsonError, readJson, serverError } from "@/lib/api/responses"
import { addToActiveProject, createImage } from "@/lib/ext/save"
import { authenticateToken } from "@/lib/ext/tokens"
import { ingestLink } from "@/lib/ingest/link"
import { UnsafeUrlError } from "@/lib/links/safe-fetch"
import { createAdminClient } from "@/lib/supabase/admin"
import { extSaveSchema, type ExtSaveResponse } from "@/lib/validation/ext"

export const maxDuration = 60

/**
 * Extension "Salvar no Awen". Links are resolved like a pasted link; images get a
 * presigned upload and are finished by /api/ext/references/:id/finalize.
 */
export async function POST(request: Request) {
  const auth = await authenticateToken(request)
  if (!auth) return jsonError(401, "Token inválido ou revogado.")

  const parsed = extSaveSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  const input = parsed.data

  try {
    const db = createAdminClient()
    let response: ExtSaveResponse
    if (input.kind === "link") {
      const { referenceId } = await ingestLink(db, auth.userId, input.url)
      response = { referenceId, project: null }
    } else {
      const { referenceId, upload } = await createImage(db, auth.userId, input)
      response = { referenceId, upload, project: null }
    }
    if (input.toProject) response.project = await addToActiveProject(db, auth.userId, response.referenceId)
    return NextResponse.json<ExtSaveResponse>(response)
  } catch (error) {
    if (error instanceof UnsafeUrlError) return jsonError(400, "Este endereço não é permitido.")
    return serverError("ext:save", error)
  }
}
