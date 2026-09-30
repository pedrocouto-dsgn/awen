import "server-only"

import type { ServerSupabase } from "@/lib/supabase/server"
import type { VocabCategory } from "@/types/database"

export type VocabTerm = { id: string; term: string; archived: boolean; sort_order: number }
export type VocabMap = Record<VocabCategory, VocabTerm[]>

export const VOCAB_CATEGORIES: VocabCategory[] = ["shot_type", "camera_angle", "camera_movement", "lighting", "mood"]

/** All terms (including archived) grouped by category, in display order. */
export async function getVocabularies(supabase: ServerSupabase): Promise<VocabMap> {
  const { data, error } = await supabase
    .from("vocabularies")
    .select("id, category, term, archived, sort_order")
    .order("sort_order")
    .order("term")
  if (error) throw error
  const map: VocabMap = { shot_type: [], camera_angle: [], camera_movement: [], lighting: [], mood: [] }
  for (const row of data ?? []) {
    map[row.category].push({ id: row.id, term: row.term, archived: row.archived, sort_order: row.sort_order })
  }
  return map
}
