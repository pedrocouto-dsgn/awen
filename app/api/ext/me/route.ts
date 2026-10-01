import { NextResponse } from "next/server"

import { jsonError, serverError } from "@/lib/api/responses"
import { getActiveProject } from "@/lib/ext/save"
import { authenticateToken } from "@/lib/ext/tokens"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ExtMeResponse } from "@/lib/validation/ext"

/** Extension: checks the token and returns the account and active project. */
export async function GET(request: Request) {
  const auth = await authenticateToken(request)
  if (!auth) return jsonError(401, "Token inválido ou revogado.")

  try {
    const db = createAdminClient()
    const [{ data: user }, activeProject] = await Promise.all([
      db.auth.admin.getUserById(auth.userId),
      getActiveProject(db, auth.userId),
    ])
    return NextResponse.json<ExtMeResponse>({ email: user?.user?.email ?? null, activeProject })
  } catch (error) {
    return serverError("ext:me", error)
  }
}
