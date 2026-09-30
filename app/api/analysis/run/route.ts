import { NextResponse } from "next/server"

import { processNext, type RunResult } from "@/lib/analysis/process"
import { dailyUsage, getQueueStats, type QueueStats } from "@/lib/analysis/stats"
import { serverError, unauthorized } from "@/lib/api/responses"
import { serverEnv } from "@/lib/env/server"
import { createClient, getUserId } from "@/lib/supabase/server"

export const maxDuration = 60

export type RunResponse = { result: RunResult; stats: QueueStats }

/** Processes at most one queued item for the signed-in user. Called in a loop by the browser worker. */
export async function POST() {
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  try {
    const limit = serverEnv().ANALYSIS_DAILY_LIMIT
    const usage = await dailyUsage(supabase, userId)
    const result: RunResult =
      usage.used >= limit
        ? {
            state: "paused",
            reason: "daily_limit",
            retryAfterMs: usage.resetInMs,
            error: `Daily analysis limit reached (${limit}).`,
          }
        : await processNext(supabase)

    return NextResponse.json<RunResponse>({ result, stats: await getQueueStats(supabase) })
  } catch (error) {
    return serverError("analysis:run", error)
  }
}
