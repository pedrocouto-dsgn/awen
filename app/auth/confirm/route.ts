import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { safeNext } from "@/features/auth/redirect"
import { createClient } from "@/lib/supabase/server"

const otpTypes = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const

const querySchema = z.object({
  token_hash: z.string().min(1).optional(),
  type: z.enum(otpTypes).optional(),
  code: z.string().min(1).optional(),
  next: z.string().optional(),
})

/**
 * Landing route for auth email links (invite, password recovery).
 * Supports both the token_hash template style and the PKCE ?code= style.
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  const url = request.nextUrl.clone()
  url.search = ""

  if (!parsed.success) {
    url.pathname = "/login"
    url.searchParams.set("erro", "link")
    return NextResponse.redirect(url)
  }

  const { token_hash, type, code, next } = parsed.data
  const supabase = await createClient()
  let ok = false

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType })
    ok = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  }

  if (!ok) {
    url.pathname = "/login"
    url.searchParams.set("erro", "link")
    return NextResponse.redirect(url)
  }

  const needsPassword = type === "invite" || type === "recovery"
  const destination = needsPassword ? "/auth/set-password" : safeNext(next)
  const [destPath = "/library", destQuery] = destination.split("?")
  url.pathname = destPath
  if (destQuery) url.search = `?${destQuery}`
  return NextResponse.redirect(url)
}
