import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"

export const metadata: Metadata = { title: "Esqueci minha senha" }

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-base font-medium">Esqueci minha senha</h1>
        <p className="text-sm text-muted-foreground">Enviamos um link para você definir uma nova senha.</p>
      </div>
      <ForgotPasswordForm />
    </div>
  )
}
