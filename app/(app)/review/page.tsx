import type { Metadata } from "next"
import Link from "next/link"

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { FailedList } from "@/features/review/components/failed-list"
import { ReviewScreen } from "@/features/review/components/review-screen"
import { getFailedItems, getReviewItems } from "@/features/review/data"
import { getQueueStats } from "@/lib/analysis/stats"
import { getActiveProject } from "@/lib/references/links"
import { getVocabularies } from "@/lib/references/vocab"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Revisão" }

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const { aba } = await searchParams
  const tab = aba === "falhas" ? "failed" : "review"
  const supabase = await createClient()

  const [stats, vocab, activeProject] = await Promise.all([
    getQueueStats(supabase),
    getVocabularies(supabase),
    getActiveProject(supabase),
  ])

  return (
    // On large screens the review fills exactly the viewport (no page scroll).
    <div className="flex flex-1 flex-col lg:h-svh lg:flex-none lg:overflow-hidden">
      <PageBreadcrumb
        items={tab === "failed" ? [{ label: "Revisão", href: "/review" }, { label: "Falharam" }] : [{ label: "Revisão" }]}
      />
      {stats.failed > 0 || tab === "failed" ? (
        <nav aria-label="Seções da revisão" className="flex gap-1 px-3 pb-3">
          <TabLink href="/review" active={tab === "review"}>
            Para revisar <Count n={stats.toReview} />
          </TabLink>
          <TabLink href="/review?aba=falhas" active={tab === "failed"}>
            Falharam <Count n={stats.failed} />
          </TabLink>
        </nav>
      ) : null}
      {tab === "review" ? (
        <ReviewScreen
          items={await getReviewItems(supabase)}
          vocab={vocab}
          queued={stats.queued + stats.analyzing}
          activeProject={activeProject}
        />
      ) : (
        <FailedList items={await getFailedItems(supabase)} />
      )}
    </div>
  )
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "type-nav flex h-9 items-center rounded-xl border border-transparent px-4 text-muted-foreground transition-colors hover:bg-glass-hover hover:text-foreground",
        active && "border-glass-border bg-gradient-steel text-foreground hover:bg-gradient-steel",
      )}
    >
      {children}
    </Link>
  )
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 text-xs tabular-nums opacity-70">{n}</span>
}
