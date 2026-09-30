import { NextResponse } from "next/server"

import { jsonError, serverError, unauthorized } from "@/lib/api/responses"
import { readPhoto, toWebpPhoto } from "@/lib/media/profile-image"
import { keys, ownsKey } from "@/lib/r2/keys"
import { deletePrefix, presignGet, putObject } from "@/lib/r2/presign"
import { createClient } from "@/lib/supabase/server"

/** Sets the profile picture (stored in R2, key kept in the user's metadata). */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return unauthorized()

  const photo = await readPhoto(request)
  if ("error" in photo) return jsonError(400, photo.error)

  try {
    let webp: Uint8Array
    try {
      webp = await toWebpPhoto(photo.bytes, "avatar")
    } catch {
      return jsonError(400, "Não foi possível ler esta imagem.")
    }
    const key = keys.avatar(user.id)
    await putObject(key, webp, "image/webp")
    const { error } = await supabase.auth.updateUser({ data: { avatar_key: key } })
    if (error) throw error

    const previous = user.user_metadata?.avatar_key
    if (typeof previous === "string" && ownsKey(user.id, previous)) await deletePrefix(previous)
    return NextResponse.json({ avatarUrl: await presignGet(key, 60 * 60) })
  } catch (error) {
    return serverError("account:avatar", error)
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return unauthorized()
  try {
    const previous = user.user_metadata?.avatar_key
    const { error } = await supabase.auth.updateUser({ data: { avatar_key: null } })
    if (error) throw error
    if (typeof previous === "string" && ownsKey(user.id, previous)) await deletePrefix(previous)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("account:avatar-delete", error)
  }
}
