"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

import { authErrorMessage } from "./messages"
import { safeNext } from "./redirect"

export type FormState = { error?: string; success?: string }

const loginSchema = z.object({
  email: z.email("Email inválido."),
  password: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
})

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) return { error: authErrorMessage(error.message) }

  await supabase.rpc("ensure_vocabularies")
  redirect(safeNext(parsed.data.next))
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

const forgotSchema = z.object({ email: z.email("Email inválido.") })

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

  const origin = await requestOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/auth/set-password`,
  })
  // Same answer whether or not the account exists (no account enumeration).
  if (error && !error.message.toLowerCase().includes("not found")) {
    return { error: authErrorMessage(error.message) }
  }
  return { success: "Se existir uma conta com este email, você vai receber um link para definir a senha." }
}

const setPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72, "Senha longa demais."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "As senhas não coincidem.", path: ["confirm"] })

export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = setPasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) {
    return { error: "Sua sessão expirou. Peça um novo link em “Esqueci minha senha”." }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: authErrorMessage(error.message) }

  await supabase.rpc("ensure_vocabularies")
  redirect("/library")
}

async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}
