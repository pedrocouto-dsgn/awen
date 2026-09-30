import { NextResponse } from "next/server"

import { invalid, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"
import { projectCreateSchema } from "@/lib/validation/entities"

export async function GET() {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, is_active")
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false })
    if (error) throw error
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return serverError("projects:list", error)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = projectCreateSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    const { data, error } = await supabase
      .from("projects")
      .insert({ name: parsed.data.name, description: parsed.data.description ?? null })
      .select("id, name, is_active")
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return serverError("projects:create", error)
  }
}
