import type { Metadata } from "next"

import { VocabularyEditor } from "@/features/settings/vocabulary-editor"
import { getVocabularies } from "@/lib/references/vocab"
import { createClient } from "@/lib/supabase/server"
import type { VocabCategory } from "@/types/database"

export const metadata: Metadata = { title: "Configurações" }

export default async function SettingsPage() {
  const supabase = await createClient()
  const [vocab, refs] = await Promise.all([
    getVocabularies(supabase),
    supabase.from("references").select("shot_type, camera_angle, camera_movement, lighting, mood").neq("status", "rejected"),
  ])
  if (refs.error) throw refs.error

  // Usage per term (personal-scale library: counted in memory).
  const counts: Record<VocabCategory, Record<string, number>> = {
    shot_type: {},
    camera_angle: {},
    camera_movement: {},
    lighting: {},
    mood: {},
  }
  const bump = (c: VocabCategory, t: string | null) => {
    if (t) counts[c][t] = (counts[c][t] ?? 0) + 1
  }
  for (const r of refs.data ?? []) {
    bump("shot_type", r.shot_type)
    bump("camera_angle", r.camera_angle)
    bump("camera_movement", r.camera_movement)
    r.lighting.forEach((t) => bump("lighting", t))
    r.mood.forEach((t) => bump("mood", t))
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="type-display-lg">Configurações</h1>
        <p className="text-muted-foreground">
          Vocabulários usados pela IA na análise e nos filtros. Os termos ficam em inglês, como a análise.
        </p>
      </header>
      <VocabularyEditor vocab={vocab} counts={counts} />
    </div>
  )
}
