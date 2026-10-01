import "server-only"

import type { z } from "zod"

import type { ServerSupabase } from "@/lib/supabase/server"
import type { promptFieldsSchema } from "@/lib/validation/prompt"
import type { TablesUpdate } from "@/types/database"

type Fields = z.output<typeof promptFieldsSchema>

/** Column values from validated form fields (links are saved separately). */
export function promptColumns(f: Fields) {
  return {
    prompt_text: f.prompt_text,
    title: f.title,
    tool: f.tool,
    model: f.model,
    type: f.type,
    status: f.status,
    origin: f.origin,
    // Author and link only make sense for someone else's prompt.
    author: f.origin === "third_party" ? f.author : null,
    source_url: f.origin === "third_party" ? f.source_url : null,
    notes: f.notes,
    version_note: f.version_note,
    tags: [...new Set(f.tags)],
    params: f.params,
    is_template: f.is_template,
  } satisfies TablesUpdate<"prompts">
}

/** Makes the prompt's inspiring references and projects exactly these sets. */
export async function syncPromptLinks(
  supabase: ServerSupabase,
  promptId: string,
  referenceIds: string[],
  projectIds: string[],
): Promise<void> {
  const [refs, projects] = await Promise.all([
    supabase.from("prompt_references").select("reference_id").eq("prompt_id", promptId),
    supabase.from("prompt_projects").select("project_id").eq("prompt_id", promptId),
  ])
  if (refs.error) throw refs.error
  if (projects.error) throw projects.error

  const refDiff = diff(
    refs.data.map((r) => r.reference_id),
    referenceIds,
  )
  const projectDiff = diff(
    projects.data.map((r) => r.project_id),
    projectIds,
  )

  const results = await Promise.all([
    refDiff.remove.length
      ? supabase.from("prompt_references").delete().eq("prompt_id", promptId).in("reference_id", refDiff.remove)
      : null,
    refDiff.add.length
      ? supabase.from("prompt_references").insert(refDiff.add.map((id) => ({ prompt_id: promptId, reference_id: id })))
      : null,
    projectDiff.remove.length
      ? supabase.from("prompt_projects").delete().eq("prompt_id", promptId).in("project_id", projectDiff.remove)
      : null,
    projectDiff.add.length
      ? supabase.from("prompt_projects").insert(projectDiff.add.map((id) => ({ prompt_id: promptId, project_id: id })))
      : null,
  ])
  const failed = results.find((r) => r?.error)
  if (failed?.error) throw failed.error
}

function diff(current: string[], wanted: string[]) {
  const have = new Set(current)
  const want = new Set(wanted)
  return { add: [...want].filter((id) => !have.has(id)), remove: [...have].filter((id) => !want.has(id)) }
}
