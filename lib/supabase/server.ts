import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { publicEnv } from "@/lib/env/public"
import type { Database } from "@/types/database"

/** Supabase client bound to the signed-in user's session (RLS applies). Create one per request. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  )
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>

/** Returns the verified user id, or null when signed out. */
export async function getUserId(supabase: ServerSupabase): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data) return null
  return data.claims.sub ?? null
}
