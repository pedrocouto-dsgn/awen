import { NextResponse } from "next/server"

import { getQueueStats } from "@/lib/analysis/stats"
import { unauthorized } from "@/lib/api/responses"
import { createClient, getUserId } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  if (!(await getUserId(supabase))) return unauthorized()
  return NextResponse.json(await getQueueStats(supabase), { headers: { "Cache-Control": "no-store" } })
}
