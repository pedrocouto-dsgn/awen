import { NextResponse } from "next/server"
import { z } from "zod"

import { getQueueStats } from "@/lib/analysis/stats"
import { invalid, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"

const schema = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(200) }),
  z.object({ allFailed: z.literal(true) }),
])

/** Puts failed items (or specific items, e.g. "re-analyze") back into the analysis queue. */
export async function POST(request: Request) {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()

  const parsed = schema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)

  try {
    let query = supabase
      .from("references")
      .update({
        status: "pending",
        analysis_attempts: 0,
        analysis_error: null,
        next_attempt_at: null,
        analyzing_since: null,
        analyzed_at: null,
      })
      .eq("media_ready", true)
    query = "ids" in parsed.data ? query.in("id", parsed.data.ids) : query.eq("status", "failed")
    const { data, error } = await query.select("id")
    if (error) throw error
    return NextResponse.json({ requeued: data?.length ?? 0, stats: await getQueueStats(supabase) })
  } catch (error) {
    return serverError("analysis:retry", error)
  }
}
