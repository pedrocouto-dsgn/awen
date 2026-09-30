import "server-only"

import { presignGet } from "@/lib/r2/presign"
import type { ServerSupabase } from "@/lib/supabase/server"

export type NavUser = {
  email: string | null
  /** Display name from the account settings (falls back to the email's local part). */
  name: string
  avatarUrl: string | null
}

/** What the sidebar needs besides the queue counters (those live in AnalysisProvider). */
export type NavData = { user: NavUser }

export async function getNavData(supabase: ServerSupabase): Promise<NavData> {
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const meta = (user?.user_metadata ?? {}) as {
    full_name?: unknown
    avatar_key?: unknown
  }
  const email = user?.email ?? null
  const name =
    typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name.trim()
      : (email?.split("@")[0] ?? "Você")
  const avatarUrl =
    typeof meta.avatar_key === "string" ? await presignGet(meta.avatar_key, 60 * 60).catch(() => null) : null

  return { user: { email, name, avatarUrl } }
}
