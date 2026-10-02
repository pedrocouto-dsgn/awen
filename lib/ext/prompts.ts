import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { processImage } from "@/lib/media/server-image"
import { keys, ownsKey } from "@/lib/r2/keys"
import { deletePrefix, getObjectBytes, headObject, presignPut, putObject } from "@/lib/r2/presign"
import type { ExtPromptInput } from "@/lib/validation/ext"
import type { Database } from "@/types/database"

import type { FinalizeResult } from "./save"

// Extension "prompt + result": runs with the secret-key client, so every query is
// scoped to the token owner explicitly (as in lib/ext/save.ts).

type Db = SupabaseClient<Database>

/**
 * Creates someone else's prompt (text and page) with its result image pending upload.
 * The extension uploads the bytes it fetched, then calls finalizePromptImage.
 */
export async function createPromptWithImage(db: Db, userId: string, input: ExtPromptInput) {
  const promptId = crypto.randomUUID()
  const assetId = crypto.randomUUID()
  const storageKey = keys.promptAsset(userId, promptId, assetId, input.image.mimeType)

  const { error } = await db.from("prompts").insert({
    id: promptId,
    owner_id: userId,
    prompt_text: input.promptText,
    title: input.pageTitle?.trim().slice(0, 200) || null,
    origin: "third_party",
    source_url: input.pageUrl ?? null,
    author: null,
  })
  if (error) throw error

  const { error: assetError } = await db.from("prompt_assets").insert({
    id: assetId,
    owner_id: userId,
    prompt_id: promptId,
    role: "result",
    storage_key: storageKey,
    kind: "image",
    mime_type: input.image.mimeType,
    file_size: input.image.size,
    media_ready: false,
  })
  if (assetError) {
    await db.from("prompts").delete().eq("id", promptId).eq("owner_id", userId)
    throw assetError
  }

  const url = await presignPut(storageKey, input.image.mimeType, input.image.size)
  return { promptId, assetId, upload: { url, contentType: input.image.mimeType } }
}

/** Checks the upload landed, then derives preview, size and palette server-side. */
export async function finalizePromptImage(db: Db, userId: string, promptId: string, assetId: string): Promise<FinalizeResult> {
  const { data: asset, error } = await db
    .from("prompt_assets")
    .select("id, storage_key, file_size, media_ready")
    .eq("id", assetId)
    .eq("prompt_id", promptId)
    .eq("owner_id", userId)
    .maybeSingle()
  if (error) throw error
  if (!asset || !asset.storage_key || !ownsKey(userId, asset.storage_key)) {
    return { ok: false, status: 404, error: "Prompt não encontrado." }
  }
  if (asset.media_ready) return { ok: true }

  const head = await headObject(asset.storage_key)
  if (!head) return { ok: false, status: 409, error: "O envio ainda não terminou." }
  if (asset.file_size && head.size !== asset.file_size) {
    return { ok: false, status: 409, error: "O arquivo enviado não confere com o esperado." }
  }

  let image: Awaited<ReturnType<typeof processImage>>
  try {
    image = await processImage(await getObjectBytes(asset.storage_key))
  } catch {
    // Not a readable image: drop the half-created prompt.
    await db.from("prompts").delete().eq("id", promptId).eq("owner_id", userId)
    await deletePrefix(keys.promptPrefix(userId, promptId))
    return { ok: false, status: 422, error: "Este arquivo não é uma imagem suportada." }
  }
  const thumbKey = keys.promptAssetThumb(userId, promptId, assetId)
  await putObject(thumbKey, image.thumbnail, "image/jpeg")

  const { error: updateError } = await db
    .from("prompt_assets")
    .update({
      thumbnail_key: thumbKey,
      mime_type: image.mime,
      width: image.width,
      height: image.height,
      palette: image.palette,
      media_ready: true,
    })
    .eq("id", assetId)
    .eq("owner_id", userId)
  if (updateError) throw updateError
  return { ok: true }
}
