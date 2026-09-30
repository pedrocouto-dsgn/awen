"use client"

import Link from "next/link"
import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { requestPasswordReset, type FormState } from "../actions"

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {})

  if (state.success) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{state.success}</p>
        <Link href="/login" className="text-sm underline underline-offset-4">
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link"}
      </Button>
      <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
        Voltar para o login
      </Link>
    </form>
  )
}
