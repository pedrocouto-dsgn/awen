import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, notFound, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { getBoardMedia } from "@/lib/board/data"
import { createClient, getUserId } from "@/lib/supabase/server"
import { boardSaveSchema } from "@/lib/validation/entities"

/** Fresh media URLs for exporting the moodboard. */
export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[id]/board">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()
  try {
    return NextResponse.json({ media: await getBoardMedia(supabase, id) })
  } catch (error) {
    return serverError("projects:board:media", error)
  }
}

/** Saves positions, sizes, stacking and captions of moodboard items. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]/board">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = boardSaveSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  try {
    const results = await Promise.all(
      parsed.data.items.map((item) =>
        supabase
          .from("project_references")
          .update({
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            z_index: item.z,
            caption: item.caption,
          })
          .eq("project_id", id)
          .eq("reference_id", item.referenceId),
      ),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("projects:board:save", error)
  }
}
