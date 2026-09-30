"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

/** "Modo aleatório" (briefing, Extras): opens one approved reference at random. */
export async function openRandomReference(): Promise<{ error: string } | never> {
  const supabase = await createClient()
  const { count } = await supabase.from("references").select("id", { count: "exact", head: true }).eq("status", "approved")
  if (!count) return { error: "A biblioteca ainda não tem referências aprovadas." }

  const offset = Math.floor(Math.random() * count)
  const { data } = await supabase
    .from("references")
    .select("id")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(offset, offset)
    .maybeSingle()
  if (!data) return { error: "Não foi possível sortear uma referência." }

  redirect(`/library/${data.id}`)
}
