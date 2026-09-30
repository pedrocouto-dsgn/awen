"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/browser"

/**
 * Supabase's default invite/recovery emails redirect with the session in the URL
 * hash (#access_token=...&type=invite). The server never sees the hash, so this
 * component picks it up, stores the session in cookies and moves on.
 */
export function AuthHashHandler() {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle")

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
    if (!hash) return
    const params = new URLSearchParams(hash)
    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const type = params.get("type")
    const hasError = params.get("error") ?? params.get("error_code")

    // Remove tokens from the address bar right away.
    window.history.replaceState(null, "", window.location.pathname + window.location.search)

    if (hasError) {
      queueMicrotask(() => setStatus("error"))
      return
    }
    if (!accessToken || !refreshToken) return

    queueMicrotask(() => setStatus("working"))
    const supabase = createClient()
    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setStatus("error")
          return
        }
        router.replace(type === "invite" || type === "recovery" ? "/auth/set-password" : "/library")
        router.refresh()
      })
  }, [router])

  if (status === "working") {
    return <p className="text-sm text-muted-foreground">A validar o link…</p>
  }
  if (status === "error") {
    return (
      <p role="alert" className="text-sm text-destructive">
        Este link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”.
      </p>
    )
  }
  return null
}
