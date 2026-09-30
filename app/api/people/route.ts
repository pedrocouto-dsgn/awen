import { NextResponse, type NextRequest } from "next/server"

import { invalid, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { findOrCreatePerson } from "@/lib/people"
import { createClient, getUserId } from "@/lib/supabase/server"
import { personCreateSchema } from "@/lib/validation/entities"

/** Autocomplete: people whose name contains `q`. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120)
  try {
    let query = supabase.from("people").select("id, name").order("name").limit(20)
    if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return serverError("people:search", error)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = personCreateSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    return NextResponse.json(await findOrCreatePerson(supabase, parsed.data.name), { status: 201 })
  } catch (error) {
    return serverError("people:create", error)
  }
}
