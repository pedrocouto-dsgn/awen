import "server-only"

import { z } from "zod"

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v)

const serverSchema = z.object({
  // Supabase secret key (sb_secret_...). Named SERVICE_ROLE_KEY for compatibility. Server-only.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined)),
  // Analysis provider: switching providers is configuration only (same JSON output).
  AI_PROVIDER: z.preprocess(blankToUndefined, z.enum(["gemini", "openrouter"]).default("gemini")),
  AI_MODEL: z.preprocess(blankToUndefined, z.string().optional()),
  AI_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  // Optional fallback provider, used only when the main provider's daily quota is used up.
  AI_FALLBACK_PROVIDER: z.preprocess(blankToUndefined, z.enum(["gemini", "openrouter"]).optional()),
  AI_FALLBACK_MODEL: z.preprocess(blankToUndefined, z.string().optional()),
  AI_FALLBACK_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  // Legacy names (Phase 1), still read as fallbacks for the Gemini provider.
  GEMINI_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  GEMINI_MODEL: z.preprocess(blankToUndefined, z.string().optional()),
  // Multimodal embeddings (always Gemini). Without a key, embeddings are skipped.
  EMBEDDING_MODEL: z.preprocess(blankToUndefined, z.string().default("gemini-embedding-2")),
  EMBEDDING_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  // Max AI analyses per user in a rolling 24h window (protects the shared AI quota).
  ANALYSIS_DAILY_LIMIT: z.coerce.number().int().positive().default(100),
  // Protects /api/cron/*. Vercel sends it as "Authorization: Bearer <CRON_SECRET>".
  CRON_SECRET: z.string().optional(),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | undefined

/** Validated server env, parsed lazily so `next build` works without secrets. */
export function serverEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ")
    throw new Error(`Invalid server environment variables: ${names}`)
  }
  cached = parsed.data
  return cached
}

const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"

export type AiConfig = { provider: ServerEnv["AI_PROVIDER"]; model: string; apiKey: string }

/** Resolved analysis provider settings. Throws a readable error when the key or model is missing. */
export function aiConfig(): AiConfig {
  const env = serverEnv()
  const gemini = env.AI_PROVIDER === "gemini"
  const apiKey = env.AI_API_KEY ?? (gemini ? env.GEMINI_API_KEY : undefined)
  const model = env.AI_MODEL ?? (gemini ? (env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL) : undefined)
  if (!apiKey) throw new Error(`Missing AI_API_KEY for provider "${env.AI_PROVIDER}".`)
  if (!model) throw new Error(`Missing AI_MODEL for provider "${env.AI_PROVIDER}".`)
  return { provider: env.AI_PROVIDER, model, apiKey }
}

/** Fallback provider settings, or null when not fully configured (then there is no fallback). */
export function aiFallbackConfig(): AiConfig | null {
  const env = serverEnv()
  const provider = env.AI_FALLBACK_PROVIDER
  if (!provider || !env.AI_FALLBACK_MODEL || !env.AI_FALLBACK_API_KEY) return null
  return { provider, model: env.AI_FALLBACK_MODEL, apiKey: env.AI_FALLBACK_API_KEY }
}

/** Embedding settings, or null when no Gemini key is configured (embeddings are then skipped). */
export function embeddingConfig(): { model: string; apiKey: string } | null {
  const env = serverEnv()
  const apiKey = env.EMBEDDING_API_KEY ?? env.GEMINI_API_KEY ?? (env.AI_PROVIDER === "gemini" ? env.AI_API_KEY : undefined)
  return apiKey ? { model: env.EMBEDDING_MODEL, apiKey } : null
}
