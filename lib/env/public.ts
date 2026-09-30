import { z } from "zod"

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Supabase publishable key (sb_publishable_...). Named ANON_KEY for compatibility.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

// NEXT_PUBLIC_* values must be referenced explicitly so Next.js can inline them in the browser bundle.
const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

if (!parsed.success) {
  // Only variable names are reported, never values.
  const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ")
  throw new Error(`Invalid public environment variables: ${names}`)
}

export const publicEnv = parsed.data
