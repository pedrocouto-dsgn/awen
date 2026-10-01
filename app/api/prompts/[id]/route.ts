import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, jsonError, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { promptColumns, syncPromptLinks } from "@/lib/prompts/save"
import { keys } from "@/lib/r2/keys"
import { deletePrefix } from "@/lib/r2/presign"
import { createClient, getUserId } from "@/lib/supabase/server"
import { promptFieldsSchema } from "@/lib/validation/prompt"

const notFound = () => jsonError(404, "Prompt não encontrado.")

/** Saves the whole form: fields, inspiring references and projects. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/prompts/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = promptFieldsSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)

  try {
    const { data, error } = await supabase
      .from("prompts")
      .update(promptColumns(parsed.data))
      .eq("id", id)
      .select("id")
      .maybeSingle()
    if (error) throw error
    if (!data) return notFound()
    await syncPromptLinks(supabase, id, parsed.data.referenceIds, parsed.data.projectIds)
    return NextResponse.json({ id })
  } catch (error) {
    return serverError("prompts:update", error)
  }
}

/** Deletes the entry and its files. Later versions keep existing (their parent link is cleared). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/prompts/[id]">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  try {
    const { data, error } = await supabase.from("prompts").delete().eq("id", id).select("id").maybeSingle()
    if (error) throw error
    if (!data) return notFound()
    await deletePrefix(keys.promptPrefix(userId, id)).catch((e: unknown) =>
      console.error("[prompts:delete] R2 cleanup failed:", e instanceof Error ? e.message : e),
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("prompts:delete", error)
  }
}
