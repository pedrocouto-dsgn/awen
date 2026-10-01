import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { PromptDetail } from "@/features/prompts/prompt-detail"
import { loadPrompt } from "@/lib/prompts/data"
import { createClient } from "@/lib/supabase/server"

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null
  return loadPrompt(await createClient(), id)
}

export async function generateMetadata({ params }: PageProps<"/prompts/[id]">): Promise<Metadata> {
  const prompt = await load((await params).id)
  return { title: prompt?.title ?? "Prompt" }
}

export default async function PromptPage({ params }: PageProps<"/prompts/[id]">) {
  const prompt = await load((await params).id)
  if (!prompt) notFound()
  return (
    <div className="flex flex-1 flex-col lg:h-svh lg:flex-none lg:overflow-hidden">
      <PageBreadcrumb
        items={[
          { label: "Prompts", href: prompt.is_template ? "/prompts?aba=modelos" : "/prompts" },
          { label: prompt.title ?? "Sem título" },
        ]}
      />
      <PromptDetail key={prompt.id} prompt={prompt} />
    </div>
  )
}
