import { redirect } from "next/navigation"

import { AppHeader } from "@/components/shell/app-header"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect("/login")

  const email = typeof data.claims.email === "string" ? data.claims.email : null

  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <AppHeader email={email} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
