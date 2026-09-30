import type { Metadata } from "next"
import Link from "next/link"

import { AuthHashHandler } from "@/features/auth/components/auth-hash-handler"
import { SetPasswordForm } from "@/features/auth/components/set-password-form"
import { createClient, getUserId } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Definir senha" }

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-base font-medium">Definir senha</h1>
        <p className="text-sm text-muted-foreground">Escolha a senha que você vai usar para entrar no Awen.</p>
      </div>
      <AuthHashHandler />
      {userId ? (
        <SetPasswordForm />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Link expirado ou sessão inválida.{" "}
          <Link href="/auth/forgot-password" className="underline underline-offset-4">
            Pedir um novo link
          </Link>
        </p>
      )}
    </div>
  )
}
