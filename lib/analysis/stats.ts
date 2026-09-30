import "server-only"

import type { ServerSupabase } from "@/lib/supabase/server"

export type QueueStats = {
  queued: number
  analyzing: number
  toReview: number
  failed: number
  nextDue: string | null
}

export const EMPTY_STATS: QueueStats = { queued: 0, analyzing: 0, toReview: 0, failed: 0, nextDue: null }

export async function getQueueStats(supabase: ServerSupabase): Promise<QueueStats> {
  const { data, error } = await supabase.rpc("queue_stats")
  const row = data?.[0]
  if (error || !row) return EMPTY_STATS
  return {
    queued: Number(row.queued),
    analyzing: Number(row.analyzing),
    toReview: Number(row.to_review),
    failed: Number(row.failed),
    nextDue: row.next_due,
  }
}

/** Analyses done by this user in the last 24h, and when the oldest one expires. */
export async function dailyUsage(supabase: ServerSupabase, userId: string) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { data, count } = await supabase
    .from("references")
    .select("analyzed_at", { count: "exact" })
    .eq("owner_id", userId)
    .gte("analyzed_at", since)
    .order("analyzed_at", { ascending: true })
    .limit(1)
  const oldest = data?.[0]?.analyzed_at
  const resetInMs = oldest ? new Date(oldest).getTime() + 24 * 3600_000 - Date.now() : 0
  return { used: count ?? 0, resetInMs: Math.max(60_000, resetInMs) }
}
