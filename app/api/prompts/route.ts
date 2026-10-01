import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { invalid, jsonError, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { searchPrompts } from "@/lib/prompts/data"
import { parsePromptFilters } from "@/lib/prompts/options"
import { promptColumns, syncPromptLinks } from "@/lib/prompts/save"
import { createClient, getUserId } from "@/lib/supabase/server"
import { promptCreateSchema } from "@/lib/validation/prompt"

/** Next page of the prompt list, same filters as the page URL. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const params = request.nextUrl.searchParams
  const offset = z.coerce.number().int().min(0).max(100_000).catch(0).parse(params.get("offset") ?? 0)
  try {
    const result = await searchPrompts(supabase, parsePromptFilters(params), offset)
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return serverError("prompts:list", error)
  }
}

/** Creates a prompt entry (or a new version of one). Files are added afterwards via /assets. */
export async function POST(request: Request) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = promptCreateSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  const { parentId, referenceIds, projectIds } = parsed.data

  try {
    if (parentId) {
      const { data: parent } = await supabase.from("prompts").select("id").eq("id", parentId).maybeSingle()
      if (!parent) return jsonError(404, "Prompt original não encontrado.")
    }
    const { data, error } = await supabase
      .from("prompts")
      .insert({ ...promptColumns(parsed.data), parent_prompt_id: parentId ?? null })
      .select("id")
      .single()
    if (error) throw error

    try {
      await syncPromptLinks(supabase, data.id, referenceIds, projectIds)
    } catch (linkError) {
      await supabase.from("prompts").delete().eq("id", data.id)
      throw linkError
    }
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    return serverError("prompts:create", error)
  }
}
