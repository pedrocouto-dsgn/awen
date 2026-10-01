import { NextResponse } from "next/server"

import { invalid, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"
import { promptBlockSchema } from "@/lib/validation/prompt"

export async function GET() {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()
  try {
    const { data, error } = await supabase
      .from("prompt_blocks")
      .select("id, name, category, body, updated_at")
      .order("category", { nullsFirst: false })
      .order("name")
    if (error) throw error
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return serverError("prompt-blocks:list", error)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = promptBlockSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    const { data, error } = await supabase
      .from("prompt_blocks")
      .insert(parsed.data)
      .select("id, name, category, body, updated_at")
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return serverError("prompt-blocks:create", error)
  }
}
