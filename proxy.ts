import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Everything except static assets, image optimization, metadata files, the cron
    // endpoint and the extension API (token auth, no session cookies).
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|api/cron|api/ext|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
}
