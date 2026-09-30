import { redirect } from "next/navigation"

import { ActiveProjectChip } from "@/components/shell/active-project-chip"
import { AppHeader } from "@/components/shell/app-header"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { AnalysisProvider } from "@/features/analysis/analysis-provider"
import { AnalysisIndicator } from "@/features/analysis/components/analysis-indicator"
import { AddReferenceDialog } from "@/features/ingest/components/add-reference-dialog"
import { GlobalDropPaste } from "@/features/ingest/components/global-drop-paste"
import { IngestTray } from "@/features/ingest/components/ingest-tray"
import { IngestProvider } from "@/features/ingest/ingest-provider"
import { getQueueStats } from "@/lib/analysis/stats"
import { getActiveProject } from "@/lib/references/links"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect("/login")

  const email = typeof data.claims.email === "string" ? data.claims.email : null
  const [stats, activeProject] = await Promise.all([getQueueStats(supabase), getActiveProject(supabase)])

  return (
    <AnalysisProvider initialStats={stats}>
      <IngestProvider>
        <div className="flex min-h-svh flex-1">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppHeader
              email={email}
              actions={
                <>
                  <ActiveProjectChip project={activeProject} />
                  <AnalysisIndicator />
                  <AddReferenceDialog />
                </>
              }
            />
            <main className="flex flex-1 flex-col">{children}</main>
          </div>
        </div>
        <GlobalDropPaste />
        <IngestTray />
      </IngestProvider>
    </AnalysisProvider>
  )
}
