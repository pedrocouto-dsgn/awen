import { NextResponse } from "next/server"

import { invalid, jsonError, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { ingestLink } from "@/lib/ingest/link"
import { UnsafeUrlError } from "@/lib/links/safe-fetch"
import { createClient, getUserId } from "@/lib/supabase/server"
import { linkSchema, type DuplicateMatch, type LinkResponse } from "@/lib/validation/ingest"

import { findDuplicates } from "../duplicates"

export const maxDuration = 60

/** Adds a reference from a URL (see ingestLink), then reports possible duplicates. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  const parsed = linkSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)

  try {
    const { referenceId, link, row } = await ingestLink(supabase, userId, parsed.data.url)

    const duplicates: DuplicateMatch[] = []
    const { data: sameUrl } = await supabase
      .from("references")
      .select("id, status, title")
      .eq("source_url", link.url)
      .neq("id", referenceId)
      .neq("status", "rejected")
      .limit(3)
    for (const d of sameUrl ?? []) duplicates.push({ id: d.id, distance: 0, status: d.status, title: d.title })
    if (row.phash) {
      for (const d of await findDuplicates(supabase, row.phash, referenceId)) {
        if (!duplicates.some((x) => x.id === d.id)) duplicates.push(d)
      }
    }

    return NextResponse.json<LinkResponse>({
      referenceId,
      provider: link.provider,
      title: row.title ?? null,
      hasMedia: Boolean(row.media_ready),
      duplicates,
    })
  } catch (error) {
    if (error instanceof UnsafeUrlError) return jsonError(400, "Este endereço não é permitido.")
    return serverError("references:link", error)
  }
}
