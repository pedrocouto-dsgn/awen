import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { serverError, unauthorized } from "@/lib/api/responses"
import { parseFilters } from "@/lib/library/filters"
import { searchLibrary } from "@/lib/library/search"
import { createClient, getUserId } from "@/lib/supabase/server"

/** Next page of library results ("Carregar mais"), same filters as the page URL. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const params = request.nextUrl.searchParams
  const offset = z.coerce.number().int().min(0).max(100_000).catch(0).parse(params.get("offset") ?? 0)

  try {
    const result = await searchLibrary(supabase, parseFilters(params), offset)
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return serverError("library:search", error)
  }
}
