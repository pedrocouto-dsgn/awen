import { NextResponse } from "next/server"

import { invalid, readJson, serverError, unauthorized } from "@/lib/api/responses"
import { generateToken } from "@/lib/ext/tokens"
import { createClient, getUserId } from "@/lib/supabase/server"
import { createTokenSchema, toTokenView, TOKEN_COLUMNS, type TokenView } from "@/lib/validation/ext"

/** Personal tokens of the signed-in user (for the Chrome extension). */
export async function GET() {
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  try {
    const { data, error } = await supabase
      .from("api_tokens")
      .select(TOKEN_COLUMNS)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
    if (error) throw error
    return NextResponse.json<TokenView[]>((data ?? []).map(toTokenView))
  } catch (error) {
    return serverError("tokens:list", error)
  }
}

/** Creates a token. The plain token is returned only in this response. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  if (!userId) return unauthorized()

  const parsed = createTokenSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid(parsed.error)

  try {
    const { token, hash, prefix } = generateToken()
    const { data, error } = await supabase
      .from("api_tokens")
      .insert({ name: parsed.data.name, token_hash: hash, token_prefix: prefix })
      .select(TOKEN_COLUMNS)
      .single()
    if (error) throw error
    return NextResponse.json<{ token: string; view: TokenView }>({ token, view: toTokenView(data) })
  } catch (error) {
    return serverError("tokens:create", error)
  }
}
