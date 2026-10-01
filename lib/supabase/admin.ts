import "server-only"

import { createClient } from "@supabase/supabase-js"

import { publicEnv } from "@/lib/env/public"
import { serverEnv } from "@/lib/env/server"
import type { Database } from "@/types/database"

/**
 * Secret-key client: bypasses RLS. Only for server code without a user session:
 * the daily analysis cron, and extension requests authenticated by a personal
 * token (lib/ext), where every query is scoped to the token owner explicitly.
 * Never use it for requests that have a session.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
