import { NextResponse } from "next/server"
import sharp from "sharp"

import { RetryableAnalysisError } from "@/lib/ai/errors"
import { jsonError, serverError, unauthorized } from "@/lib/api/responses"
import { createImageQuery } from "@/lib/library/query-vectors"
import { LIMITS } from "@/lib/media/limits"
import { readPhoto } from "@/lib/media/profile-image"
import { createClient, getUserId } from "@/lib/supabase/server"

/** Search by image: embeds a dropped or chosen image and returns the search id for ?imagem=. */
export async function POST(request: Request) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const photo = await readPhoto(request)
  if ("error" in photo) return jsonError(400, photo.error)

  let image: Buffer
  let preview: Buffer
  try {
    const base = sharp(photo.bytes, { failOn: "error", limitInputPixels: 80_000_000 }).rotate()
    ;[image, preview] = await Promise.all([
      // Same treatment as reference previews, so both sides of the comparison look alike.
      base
        .clone()
        .resize(LIMITS.thumbMaxSide, LIMITS.thumbMaxSide, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 84 }).toBuffer(),
      base.clone().resize(160, 160, { fit: "inside" }).flatten({ background: "#ffffff" }).jpeg({ quality: 70 }).toBuffer(),
    ])
  } catch {
    return jsonError(400, "Não foi possível ler esta imagem.")
  }

  try {
    const id = await createImageQuery(supabase, image, `data:image/jpeg;base64,${preview.toString("base64")}`)
    return NextResponse.json({ id })
  } catch (error) {
    if (error instanceof RetryableAnalysisError) {
      return jsonError(503, "A busca por imagem está indisponível agora (limite da IA). Tente mais tarde.")
    }
    return serverError("search:image", error)
  }
}
