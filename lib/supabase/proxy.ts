import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { publicEnv } from "@/lib/env/public"
import type { Database } from "@/types/database"

const PUBLIC_PATHS = ["/login", "/auth"]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Refreshes the auth session cookie and protects app routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // Do not run code between createServerClient and getClaims (session refresh).
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/api/")) {
    // API routes check auth themselves and answer with JSON, never a redirect.
    return response
  }

  // Password-recovery links fall back to the Site URL ("/?code=...") when the
  // redirect URL is not allow-listed in Supabase. Forward the code so it is not lost.
  const code = request.nextUrl.searchParams.get("code")
  if (code && (pathname === "/" || pathname === "/login")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/confirm"
    url.search = ""
    url.searchParams.set("code", code)
    url.searchParams.set("next", "/auth/set-password")
    return withCookies(NextResponse.redirect(url), response)
  }

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`
    return withCookies(NextResponse.redirect(url), response)
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/library"
    url.search = ""
    return withCookies(NextResponse.redirect(url), response)
  }

  return response
}

function withCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((c) => target.cookies.set(c))
  source.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie" && !target.headers.has(key)) target.headers.set(key, value)
  })
  return target
}
