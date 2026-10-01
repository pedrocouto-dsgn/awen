import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, jsonError, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"
import { promptBlockSchema } from "@/lib/validation/prompt"

const notFound = () => jsonError(404, "Bloco não encontrado.")

export async function PATCH(request: Request, ctx: RouteContext<"/api/prompt-blocks/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = promptBlockSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    const { data, error } = await supabase
      .from("prompt_blocks")
      .update(parsed.data)
      .eq("id", id)
      .select("id, name, category, body, updated_at")
      .maybeSingle()
    if (error) throw error
    if (!data) return notFound()
    return NextResponse.json(data)
  } catch (error) {
    return serverError("prompt-blocks:update", error)
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/prompt-blocks/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()
  try {
    const { data, error } = await supabase.from("prompt_blocks").delete().eq("id", id).select("id").maybeSingle()
    if (error) throw error
    if (!data) return notFound()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("prompt-blocks:delete", error)
  }
}
