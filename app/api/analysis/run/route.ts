import { NextResponse } from "next/server"

import { embedNext } from "@/lib/analysis/embed"
import { processNext, type RunResult } from "@/lib/analysis/process"
import { analyzeNextPrompt, embedNextPrompts } from "@/lib/analysis/prompts"
import { dailyUsage, getQueueStats, type QueueStats } from "@/lib/analysis/stats"
import { serverError, unauthorized } from "@/lib/api/responses"
import { serverEnv } from "@/lib/env/server"
import { createClient, getUserId } from "@/lib/supabase/server"

export const maxDuration = 60

export type RunResponse = { result: RunResult; stats: QueueStats }

/**
 * Processes at most one queued item for the signed-in user. Called in a loop by the browser worker.
 * When no reference is waiting, analyzes a prompt; when nothing is, embeds a batch of
 * approved references or prompts instead.
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

    // Then prompts (their analysis counts toward the same daily limit).
    if (result.state === "idle") {
      const analyzed = await analyzeNextPrompt(supabase)
      if (analyzed.state !== "idle") result = analyzed
    }

    // Embeddings do not count toward the daily analysis limit.
    if (result.state === "idle" || (result.state === "paused" && result.reason === "daily_limit")) {
      const embedded = await embedNext(supabase)
      if (embedded.state !== "idle") result = embedded
      else {
        const promptsEmbedded = await embedNextPrompts(supabase)
        if (promptsEmbedded.state !== "idle") result = promptsEmbedded
      }
    }

    return NextResponse.json<RunResponse>({ result, stats: await getQueueStats(supabase) })
  } catch (error) {
    return serverError("analysis:run", error)
  }
}
