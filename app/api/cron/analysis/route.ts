import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { embedNext } from "@/lib/analysis/embed"
import { processNext, type RunResult } from "@/lib/analysis/process"
import { jsonError, serverError } from "@/lib/api/responses"
import { serverEnv } from "@/lib/env/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60

const BUDGET_MS = 50_000
const MAX_ITEMS = 20

function authorized(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(header)
  return received.length === expected.length && timingSafeEqual(received, expected)
}

/**
 * Daily safety net (Vercel Cron): drains part of the queue for all users even
 * when nobody has the app open, then embeds approved references. The browser
 * worker does the real-time work.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return jsonError(401, "Unauthorized")

  try {
    const db = createAdminClient()
    const started = Date.now()
    const results: RunResult["state"][] = []
    while (Date.now() - started < BUDGET_MS && results.length < MAX_ITEMS) {
      const result = await processNext(db)
      results.push(result.state)
      if (result.state === "idle" || result.state === "paused") break
    }
    while (Date.now() - started < BUDGET_MS && results.length < MAX_ITEMS) {
      const result = await embedNext(db)
      results.push(result.state)
      if (result.state !== "embedded" || result.count === 0) break
    }
    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    return serverError("cron:analysis", error)
  }
}
