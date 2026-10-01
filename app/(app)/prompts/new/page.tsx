import type { Metadata } from "next"
import { z } from "zod"

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { PromptForm } from "@/features/prompts/prompt-form"
import { loadPrompt, toolSuggestions } from "@/lib/prompts/data"
import { fillTemplate } from "@/lib/prompts/options"
import { presignGet } from "@/lib/r2/presign"
import { VIEW_TTL_SECONDS } from "@/lib/references/view"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Novo prompt" }

const uuid = (v: unknown) => (typeof v === "string" && z.uuid().safeParse(v).success ? v : null)

/**
 * ?versao=<id> starts a new version of that prompt; ?referencia=<id> preselects an
 * inspiring reference; ?de=<template id>&v_<name>=<value> starts from a filled template.
 */
export default async function NewPromptPage({ searchParams }: PageProps<"/prompts/new">) {
  const params = await searchParams
  const supabase = await createClient()
  const parentId = uuid(params.versao)
  const referenceId = uuid(params.referencia)
  const templateId = uuid(params.de)

  const [parent, template, suggestions, projects, reference] = await Promise.all([
    parentId ? loadPrompt(supabase, parentId) : null,
    templateId ? loadPrompt(supabase, templateId) : null,
    toolSuggestions(supabase),
    supabase.from("projects").select("id, name").order("name"),
    referenceId
      ? supabase.from("references").select("id, title, type, thumbnail_key").eq("id", referenceId).maybeSingle()
      : null,
  ])
  const ref = reference?.data
  const initialReference = ref
    ? {
        id: ref.id,
        title: ref.title,
        type: ref.type,
        thumbUrl: ref.thumbnail_key ? await presignGet(ref.thumbnail_key, VIEW_TTL_SECONDS) : null,
      }
    : null
  const asTemplate = params.modelo === "1"

  // A filled template becomes a regular prompt: its text with the values, the rest of its fields.
  const values: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith("v_") && typeof v === "string") values[k.slice(2)] = v.slice(0, 2000)
  }
  const copyFrom =
    template?.is_template && !parent
      ? { ...template, prompt_text: fillTemplate(template.prompt_text, values), is_template: false, title: null, results: [] }
      : null

  return (
    <>
      <PageBreadcrumb
        items={[
          { label: "Prompts", href: asTemplate ? "/prompts?aba=modelos" : "/prompts" },
          ...(parent
            ? [{ label: parent.title ?? "Prompt", href: `/prompts/${parent.id}` }, { label: "Nova versão" }]
            : [{ label: asTemplate ? "Novo modelo" : "Novo prompt" }]),
        ]}
      />
      <div className="px-4 pt-4 pb-8 md:px-8">
        <PromptForm
          prompt={null}
          parent={parent}
          copyFrom={copyFrom}
          template={asTemplate}
          initialReference={initialReference}
          suggestions={suggestions}
          projects={projects.data ?? []}
        />
      </div>
    </>
  )
}
