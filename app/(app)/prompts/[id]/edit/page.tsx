import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { PromptForm } from "@/features/prompts/prompt-form"
import { loadPrompt, toolSuggestions } from "@/lib/prompts/data"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Editar prompt" }

export default async function EditPromptPage({ params }: PageProps<"/prompts/[id]/edit">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const supabase = await createClient()
  const [prompt, suggestions, projects] = await Promise.all([
    loadPrompt(supabase, id),
    toolSuggestions(supabase),
    supabase.from("projects").select("id, name").order("name"),
  ])
  if (!prompt) notFound()

  return (
    <>
      <PageBreadcrumb
        items={[
          { label: "Prompts", href: "/prompts" },
          { label: prompt.title ?? "Prompt", href: `/prompts/${prompt.id}` },
          { label: "Editar" },
        ]}
      />
      <div className="px-4 pt-4 pb-8 md:px-8">
        <PromptForm prompt={prompt} suggestions={suggestions} projects={projects.data ?? []} />
      </div>
    </>
  )
}
