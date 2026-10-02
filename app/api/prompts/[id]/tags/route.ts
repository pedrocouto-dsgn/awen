import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, jsonError, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"

const bodySchema = z.object({ tag: z.string().trim().toLowerCase().min(1).max(40) })

/** Accepts one AI-suggested tag (adds it to the prompt's tags). */
export async function POST(request: Request, ctx: RouteContext<"/api/prompts/[id]/tags">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Prompt não encontrado.")

  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = bodySchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)

  try {
    const { data: prompt, error } = await supabase.from("prompts").select("tags").eq("id", id).maybeSingle()
    if (error) throw error
    if (!prompt) return jsonError(404, "Prompt não encontrado.")
    const tags = [...new Set([...prompt.tags, parsed.data.tag])].slice(0, 30)
    const { error: updateError } = await supabase.from("prompts").update({ tags }).eq("id", id)
    if (updateError) throw updateError
    return NextResponse.json({ tags })
  } catch (error) {
    return serverError("prompts:tags", error)
  }
}
