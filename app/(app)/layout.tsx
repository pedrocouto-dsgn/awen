import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/shell/app-sidebar"
import { MobileNav } from "@/components/shell/mobile-nav"
import { isSidebarExpanded, SIDEBAR_COOKIE } from "@/components/shell/sidebar-state"
import { AnalysisProvider } from "@/features/analysis/analysis-provider"
import { AddReferenceDialog } from "@/features/ingest/components/add-reference-dialog"
import { GlobalDropPaste } from "@/features/ingest/components/global-drop-paste"
import { IngestTray } from "@/features/ingest/components/ingest-tray"
import { IngestProvider } from "@/features/ingest/ingest-provider"
import { getQueueStats } from "@/lib/analysis/stats"
import { getNavData } from "@/lib/shell/nav-data"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect("/login")

  const [stats, nav, cookieStore] = await Promise.all([getQueueStats(supabase), getNavData(supabase), cookies()])
  const sidebarExpanded = isSidebarExpanded(cookieStore.get(SIDEBAR_COOKIE)?.value)

  return (
    <AnalysisProvider initialStats={stats}>
      <IngestProvider>
        <div className="flex min-h-svh flex-1">
          <AppSidebar data={nav} defaultExpanded={sidebarExpanded} />
          <MobileNav data={nav} />
          <main className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">{children}</main>
        </div>
        <AddReferenceDialog />
        <GlobalDropPaste />
        <IngestTray />
      </IngestProvider>
    </AnalysisProvider>
  )
}
