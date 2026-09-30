import type { Metadata } from "next"

import { AuthHashHandler } from "@/features/auth/components/auth-hash-handler"
import { LoginForm } from "@/features/auth/components/login-form"
import { safeNext } from "@/features/auth/redirect"

export const metadata: Metadata = { title: "Entrar" }

const errors: Record<string, string> = {
  link: "Este link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”.",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const next = typeof params.next === "string" ? safeNext(params.next) : undefined
  const erro = typeof params.erro === "string" ? errors[params.erro] : undefined

  return (
    <div className="flex flex-col gap-4">
      <AuthHashHandler />
      <LoginForm next={next} initialError={erro} />
    </div>
  )
}
