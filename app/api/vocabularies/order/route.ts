import { NextResponse } from "next/server"

import { invalid, jsonError, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"
import { vocabOrderSchema } from "@/lib/validation/reference"

/** Saves the display order of one category. */
export async function PUT(request: Request) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = vocabOrderSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    const { error } = await supabase.rpc("reorder_vocabulary", {
      p_category: parsed.data.category,
      p_ids: parsed.data.ids,
    })
    if (error) {
      if (error.code === "PGRST202") {
        return jsonError(500, "Aplique a migration 20260930000004_vocabulary_admin.sql no Supabase.")
      }
      throw error
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("vocabularies:order", error)
  }
}
