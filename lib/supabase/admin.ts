import "server-only"

import { createClient } from "@supabase/supabase-js"

import { publicEnv } from "@/lib/env/public"
import { serverEnv } from "@/lib/env/server"
import type { Database } from "@/types/database"

/**
 * Secret-key client: bypasses RLS. Only for trusted server jobs without a user
 * session (the daily analysis cron). Never use it to serve user requests.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
