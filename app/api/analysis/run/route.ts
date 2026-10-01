import { NextResponse } from "next/server"

import { embedNext } from "@/lib/analysis/embed"
import { processNext, type RunResult } from "@/lib/analysis/process"
import { dailyUsage, getQueueStats, type QueueStats } from "@/lib/analysis/stats"
import { serverError, unauthorized } from "@/lib/api/responses"
import { serverEnv } from "@/lib/env/server"
import { createClient, getUserId } from "@/lib/supabase/server"

export const maxDuration = 60

export type RunResponse = { result: RunResult; stats: QueueStats }

/**
 * Processes at most one queued item for the signed-in user. Called in a loop by the browser worker.
 * When there is nothing to analyze, embeds a batch of approved references instead.
 */
export async function POST() {
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  try {
    const limit = serverEnv().ANALYSIS_DAILY_LIMIT
    const usage = await dailyUsage(supabase, userId)
    let result: RunResult =
      usage.used >= limit
        ? {
            state: "paused",
            reason: "daily_limit",
            retryAfterMs: usage.resetInMs,
            error: `Daily analysis limit reached (${limit}).`,
          }
        : await processNext(supabase)

    // Embeddings do not count toward the daily analysis limit.
    if (result.state === "idle" || (result.state === "paused" && result.reason === "daily_limit")) {
      const embedded = await embedNext(supabase)
      if (embedded.state !== "idle") result = embedded
    }

    return NextResponse.json<RunResponse>({ result, stats: await getQueueStats(supabase) })
  } catch (error) {
    return serverError("analysis:run", error)
  }
}
