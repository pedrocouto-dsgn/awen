import type { Metadata } from "next"
import Link from "next/link"

import { FailedList } from "@/features/review/components/failed-list"
import { ReviewScreen } from "@/features/review/components/review-screen"
import { getFailedItems, getReviewItems } from "@/features/review/data"
import { getQueueStats } from "@/lib/analysis/stats"
import { getVocabularies } from "@/lib/references/vocab"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Revisão" }

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const { aba } = await searchParams
  const tab = aba === "falhas" ? "failed" : "review"
  const supabase = await createClient()

  const [stats, vocab, items] = await Promise.all([
    getQueueStats(supabase),
    getVocabularies(supabase),
    tab === "review" ? getReviewItems(supabase) : getFailedItems(supabase),
  ])

  return (
    // On large screens the review fills exactly the viewport under the header (no page scroll).
    <div className="flex flex-1 flex-col lg:h-[calc(100svh-4rem)] lg:flex-none lg:overflow-hidden">
      {stats.failed > 0 || tab === "failed" ? (
        <nav aria-label="Seções da revisão" className="flex gap-1 border-b px-4 py-1.5 md:px-6">
          <TabLink href="/review" active={tab === "review"}>
            Para revisar <Count n={stats.toReview} />
          </TabLink>
          <TabLink href="/review?aba=falhas" active={tab === "failed"}>
            Falharam <Count n={stats.failed} />
          </TabLink>
        </nav>
      ) : null}
      {tab === "review" ? (
        <ReviewScreen items={items} vocab={vocab} queued={stats.queued + stats.analyzing} />
      ) : (
        <FailedList items={items} />
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
        "type-nav flex h-9 items-center px-4 text-muted-foreground hover:text-foreground",
        active && "bg-gradient-steel text-foreground",
      )}
    >
      {children}
    </Link>
  )
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 text-xs tabular-nums opacity-70">{n}</span>
}
