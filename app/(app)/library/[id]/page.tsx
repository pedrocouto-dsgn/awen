import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { ReferenceDetail } from "@/features/library/components/reference-detail"
import { toReferenceView } from "@/lib/references/view"
import { getVocabularies } from "@/lib/references/vocab"
import { createClient } from "@/lib/supabase/server"

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await createClient()
  const { data } = await supabase.from("references").select("*").eq("id", id).maybeSingle()
  return data ? { supabase, ref: data } : null
}

export async function generateMetadata({ params }: PageProps<"/library/[id]">): Promise<Metadata> {
  const found = await load((await params).id)
  return { title: found?.ref.title ?? "Referência" }
}

export default async function ReferencePage({ params }: PageProps<"/library/[id]">) {
  const found = await load((await params).id)
  if (!found) notFound()

  const [view, vocab] = await Promise.all([toReferenceView(found.ref), getVocabularies(found.supabase)])
  return <ReferenceDetail key={view.id} reference={view} vocab={vocab} />
}
