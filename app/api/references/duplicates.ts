import "server-only"

import type { ServerSupabase } from "@/lib/supabase/server"
import type { DuplicateMatch } from "@/lib/validation/ingest"

const MAX_DISTANCE = 8

export async function findDuplicates(
  supabase: ServerSupabase,
  phash: string,
  excludeId: string,
): Promise<DuplicateMatch[]> {
  const { data, error } = await supabase.rpc("find_near_duplicates", {
    p_phash: phash,
    p_max_distance: MAX_DISTANCE,
    p_exclude: excludeId,
  })
  if (error || !data) return []
  return data.map((d) => ({ id: d.id, distance: d.distance, status: d.status, title: d.title }))
}
