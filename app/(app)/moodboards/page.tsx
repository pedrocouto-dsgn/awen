import type { Metadata } from "next"

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { MoodboardsGrid } from "@/features/board/moodboards-grid"
import { getProjectCards } from "@/lib/projects/cards"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Moodboards" }

export default async function MoodboardsPage() {
  const cards = await getProjectCards(await createClient())

  return (
    <>
      <PageBreadcrumb items={[{ label: "Moodboards" }]} />
      <MoodboardsGrid projects={cards} />
    </>
  )
}
