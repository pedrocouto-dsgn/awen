import "server-only"

import { loadLinks, type ReferenceLinksData } from "@/lib/references/links"
import { toReferenceView, type ReferenceView } from "@/lib/references/view"
import type { ServerSupabase } from "@/lib/supabase/server"

const LIMIT = 100

export type ReviewItem = ReferenceView & { links: ReferenceLinksData }

/** Items waiting for review: analyzed pending items, plus link-only items without media. */
export async function getReviewItems(supabase: ServerSupabase): Promise<ReviewItem[]> {
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .eq("status", "pending")
    .or("analyzed_at.not.is.null,media_ready.eq.false")
    .order("created_at", { ascending: true })
    .limit(LIMIT)
  if (error) throw error
  const rows = data ?? []
  const [views, links] = await Promise.all([
    Promise.all(rows.map((r) => toReferenceView(r))),
    loadLinks(
      supabase,
      rows.map((r) => r.id),
    ),
  ])
  return views.map((v) => ({ ...v, links: links.get(v.id) ?? { people: [], projects: [] } }))
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
