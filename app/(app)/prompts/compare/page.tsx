import { GitCompareIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { z } from "zod"

import { EmptyState } from "@/components/shell/empty-state"
import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { PromptCompare } from "@/features/prompts/prompt-compare"
import { loadPrompt } from "@/lib/prompts/data"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Comparar versões" }

const uuid = (v: unknown) => (typeof v === "string" && z.uuid().safeParse(v).success ? v : null)

/** ?a=<id>&b=<id>: two prompts side by side (usually two versions of the same one). */
export default async function ComparePage({ searchParams }: PageProps<"/prompts/compare">) {
  const params = await searchParams
  const supabase = await createClient()
  const [a, b] = await Promise.all([
    uuid(params.a) ? loadPrompt(supabase, uuid(params.a)!) : null,
    uuid(params.b) ? loadPrompt(supabase, uuid(params.b)!) : null,
  ])

  if (!a || !b) {
    return (
      <>
        <PageBreadcrumb items={[{ label: "Prompts", href: "/prompts" }, { label: "Comparar" }]} />
        <EmptyState icon={GitCompareIcon} title="Nada para comparar" description="Abra um prompt com mais de uma versão e use “Comparar”." />
      </>
    )
  }

  // Older on the left.
  const [before, after] = a.created_at <= b.created_at ? [a, b] : [b, a]
  const versions = after.versions.length > 1 ? after.versions : before.versions

  return (
    <>
      <PageBreadcrumb
        items={[
          { label: "Prompts", href: "/prompts" },
          { label: after.title ?? "Prompt", href: `/prompts/${after.id}` },
          { label: "Comparar versões" },
        ]}
      />
      <div className="flex flex-col gap-6 px-4 pt-4 pb-8 md:px-8">
        {versions.length > 2 ? (
          <nav aria-label="Escolher versões" className="flex flex-wrap items-center gap-2 text-sm">
            <span className="type-label text-muted-foreground">Versões</span>
            {versions.map((v) => {
              const on = v.id === before.id || v.id === after.id
              // Clicking a version compares it with its neighbour (the one before, or v2 for v1).
              const other = versions[v.number - 2] ?? versions[1]!
              return (
                <Link
                  key={v.id}
                  href={`/prompts/compare?a=${other.id}&b=${v.id}`}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 tabular-nums transition-colors",
                    on ? "border-ring text-foreground" : "border-border-strong text-muted-foreground hover:text-foreground",
                  )}
                >
                  v{v.number}
                </Link>
              )
            })}
          </nav>
        ) : null}
        <PromptCompare before={before} after={after} />
      </div>
    </>
  )
}
