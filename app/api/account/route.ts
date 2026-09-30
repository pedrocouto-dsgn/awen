import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient } from "@/lib/supabase/server"

const accountSchema = z.object({ name: z.string().trim().max(80) })

/** Display name, kept in the user's metadata (no extra table). */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return unauthorized()

  const parsed = accountSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    const { error } = await supabase.auth.updateUser({ data: { full_name: parsed.data.name || null } })
    if (error) throw error
    return NextResponse.json({ name: parsed.data.name })
  } catch (error) {
    return serverError("account:update", error)
  }
}
