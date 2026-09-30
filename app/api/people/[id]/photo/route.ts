import { NextResponse } from "next/server"
import { z } from "zod"

import { jsonError, notFound, serverError, unauthorized } from "@/lib/api/responses"
import { readPhoto, toWebpPhoto } from "@/lib/media/profile-image"
import { keys, ownsKey } from "@/lib/r2/keys"
import { deletePrefix, presignGet, putObject } from "@/lib/r2/presign"
import { createClient, getUserId } from "@/lib/supabase/server"

async function loadPerson(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return { supabase, userId: null, person: null }
  const { data } = await supabase.from("people").select("id, photo_key").eq("id", id).maybeSingle()
  return { supabase, userId, person: data }
}

/** Sets the artist photo shown as the banner of the artist page. */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/photo">) {
  const found = await loadPerson((await ctx.params).id)
  if (!found) return notFound()
  const { supabase, userId, person } = found
  if (!userId) return unauthorized()
  if (!person) return jsonError(404, "Artista não encontrado.")

  const photo = await readPhoto(request)
  if ("error" in photo) return jsonError(400, photo.error)

  try {
    let webp: Uint8Array
    try {
      webp = await toWebpPhoto(photo.bytes, "banner")
    } catch {
      return jsonError(400, "Não foi possível ler esta imagem.")
    }
    const key = keys.personPhoto(userId, person.id)
    await putObject(key, webp, "image/webp")
    const { error } = await supabase.from("people").update({ photo_key: key }).eq("id", person.id)
    if (error) throw error
    if (person.photo_key && ownsKey(userId, person.photo_key)) await deletePrefix(person.photo_key)
    return NextResponse.json({ photoUrl: await presignGet(key, 60 * 60) })
  } catch (error) {
    return serverError("people:photo", error)
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/people/[id]/photo">) {
  const found = await loadPerson((await ctx.params).id)
  if (!found) return notFound()
  const { supabase, userId, person } = found
  if (!userId) return unauthorized()
  if (!person) return jsonError(404, "Artista não encontrado.")
  try {
    const { error } = await supabase.from("people").update({ photo_key: null }).eq("id", person.id)
    if (error) throw error
    if (person.photo_key && ownsKey(userId, person.photo_key)) await deletePrefix(person.photo_key)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError("people:photo-delete", error)
  }
}
