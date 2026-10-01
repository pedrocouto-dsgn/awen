import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"

const TOKEN_PREFIX = "awen_"
const LAST_USED_THROTTLE_MS = 5 * 60_000

/** A new personal token. Only the hash is stored; the token is shown to the user once. */
export function generateToken(): { token: string; hash: string; prefix: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url")
  return { token, hash: hashToken(token), prefix: token.slice(0, 12) }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export type TokenAuth = { userId: string; tokenId: string }

/**
 * Resolves "Authorization: Bearer awen_…" to its owner. Returns null for missing,
 * unknown or revoked tokens. Uses the secret-key client: there is no user session.
 */
export async function authenticateToken(request: Request): Promise<TokenAuth | null> {
  const header = request.headers.get("authorization") ?? ""
  const token = /^Bearer\s+(awen_[A-Za-z0-9_-]{20,})$/.exec(header)?.[1]
  if (!token) return null

  const db = createAdminClient()
  const { data, error } = await db
    .from("api_tokens")
    .select("id, owner_id, last_used_at")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle()
  if (error || !data) return null

  const lastUsed = data.last_used_at ? new Date(data.last_used_at).getTime() : 0
  if (Date.now() - lastUsed > LAST_USED_THROTTLE_MS) {
    await db.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id)
  }
  return { userId: data.owner_id, tokenId: data.id }
}
