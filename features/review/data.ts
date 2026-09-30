import "server-only"

import { toReferenceView, type ReferenceView } from "@/lib/references/view"
import type { ServerSupabase } from "@/lib/supabase/server"

const LIMIT = 100

/** Items waiting for review: analyzed pending items, plus link-only items without media. */
export async function getReviewItems(supabase: ServerSupabase): Promise<ReferenceView[]> {
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .eq("status", "pending")
    .or("analyzed_at.not.is.null,media_ready.eq.false")
    .order("created_at", { ascending: true })
    .limit(LIMIT)
  if (error) throw error
  return Promise.all((data ?? []).map((r) => toReferenceView(r)))
}

export async function getFailedItems(supabase: ServerSupabase): Promise<ReferenceView[]> {
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(LIMIT)
  if (error) throw error
  return Promise.all((data ?? []).map((r) => toReferenceView(r)))
}
