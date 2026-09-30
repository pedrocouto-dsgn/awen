import "server-only"

import { z } from "zod"

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
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : "gemini-3.8-flash")),
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
