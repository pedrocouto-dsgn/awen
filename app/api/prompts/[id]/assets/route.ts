import { NextResponse } from "next/server"
import { z } from "zod"

import { invalid, jsonError, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { keys } from "@/lib/r2/keys"
import { presignPut } from "@/lib/r2/presign"
import { createClient, getUserId } from "@/lib/supabase/server"
import { promptAssetCreateSchema, type PromptAssetCreateResponse } from "@/lib/validation/prompt"

/**
 * Adds a result or input to a prompt: either an existing reference, or a file the
 * browser uploads straight to R2 with the returned URLs, then finalizes.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/prompts/[id]/assets">) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Prompt não encontrado.")

  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  const parsed = promptAssetCreateSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)
  const input = parsed.data

  try {
    const { data: prompt } = await supabase.from("prompts").select("id").eq("id", id).maybeSingle()
    if (!prompt) return jsonError(404, "Prompt não encontrado.")

    // New assets go to the end of their group.
    const { data: last } = await supabase
      .from("prompt_assets")
      .select("sort_order")
      .eq("prompt_id", id)
      .eq("role", input.role)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()
    const sortOrder = (last?.sort_order ?? -1) + 1

    if (input.source === "reference") {
      const { data: ref } = await supabase.from("references").select("id, type").eq("id", input.referenceId).maybeSingle()
      if (!ref) return jsonError(404, "Referência não encontrada.")
      const { data, error } = await supabase
        .from("prompt_assets")
        .insert({ prompt_id: id, role: input.role, reference_id: ref.id, kind: ref.type, sort_order: sortOrder, media_ready: true })
        .select("id")
        .single()
      if (error) throw error
      return NextResponse.json<PromptAssetCreateResponse>({ assetId: data.id }, { status: 201 })
    }

    const assetId = crypto.randomUUID()
    const storageKey = keys.promptAsset(userId, id, assetId, input.file.mimeType)
    const thumbKey = keys.promptAssetThumb(userId, id, assetId)
    const { error } = await supabase.from("prompt_assets").insert({
      id: assetId,
      prompt_id: id,
      role: input.role,
      storage_key: storageKey,
      thumbnail_key: thumbKey,
      kind: input.file.type,
      mime_type: input.file.mimeType,
      file_size: input.file.size,
      width: input.tech.width,
      height: input.tech.height,
      duration: input.file.type === "video" ? (input.tech.duration ?? null) : null,
      palette: input.tech.palette,
      sort_order: sortOrder,
      media_ready: false,
    })
    if (error) throw error

    const [originalUrl, thumbUrl] = await Promise.all([
      presignPut(storageKey, input.file.mimeType, input.file.size),
      presignPut(thumbKey, "image/jpeg", input.thumb.size),
    ])
    return NextResponse.json<PromptAssetCreateResponse>(
      {
        assetId,
        upload: {
          original: { url: originalUrl, contentType: input.file.mimeType },
          thumb: { url: thumbUrl, contentType: "image/jpeg" },
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return serverError("prompts:assets:create", error)
  }
}
