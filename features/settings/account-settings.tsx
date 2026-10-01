"use client"

import { CameraIcon, Loader2Icon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon, Trash2Icon } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"

import { Avatar } from "@/components/shell/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changePassword, signOut, type FormState } from "@/features/auth/actions"
import type { NavUser } from "@/lib/shell/nav-data"
import { cn } from "@/lib/utils"

import { AvatarCropper } from "./avatar-cropper"
import { Panel } from "./panel"

/** "Conta" tab of the settings page: photo, name, password, theme, sign out. */
export function AccountSettings({ user }: { user: NavUser }) {
  return (
    <div className="flex flex-col gap-4">
      <ProfilePanel user={user} />
      <PasswordPanel />
      <ThemePanel />
      <Panel title="Sessão" description="Encerra o acesso neste dispositivo.">
        <div>
          <Button variant="destructive" onClick={() => void signOut()}>
            <LogOutIcon /> Sair
          </Button>
        </div>
      </Panel>
    </div>
  )
}

function ProfilePanel({ user }: { user: NavUser }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user.email?.split("@")[0] === user.name ? "" : user.name)
  const [savingName, setSavingName] = useState(false)
  const [photoBusy, setPhotoBusy] = useState<"upload" | "remove" | null>(null)
  /** File being framed in the cropper; the upload happens after "Salvar foto". */
  const [picked, setPicked] = useState<File | null>(null)

  async function uploadCropped(blob: Blob) {
    setPhotoBusy("upload")
    try {
      const body = new FormData()
      body.set("file", blob, blob.type === "image/webp" ? "avatar.webp" : "avatar.jpg")
      const res = await fetch("/api/account/avatar", { method: "POST", body })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar a foto.")
      setPicked(null)
      toast.success("Foto atualizada.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.")
    } finally {
      setPhotoBusy(null)
    }
  }

  async function removePhoto() {
    setPhotoBusy("remove")
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Foto removida.")
      router.refresh()
    } catch {
      toast.error("Não foi possível remover a foto.")
    } finally {
      setPhotoBusy(null)
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error()
      toast.success("Nome salvo.")
      router.refresh()
    } catch {
      toast.error("Não foi possível salvar o nome.")
    } finally {
      setSavingName(false)
    }
  }

  return (
    <Panel title="Perfil" description="Como você aparece no menu lateral.">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={user.name} url={user.avatarUrl} className="size-20 text-2xl" />
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={photoBusy !== null}>
            {photoBusy === "upload" ? <Loader2Icon className="animate-spin" /> : <CameraIcon />}
            {user.avatarUrl ? "Trocar foto" : "Enviar foto"}
          </Button>
          {user.avatarUrl ? (
            <Button variant="ghost" size="sm" onClick={() => void removePhoto()} disabled={photoBusy !== null}>
              {photoBusy === "remove" ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />} Remover
            </Button>
          ) : null}
          <p className="w-full text-xs text-muted-foreground">JPG, PNG ou WebP. Você ajusta o enquadramento antes de salvar.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file?.type.startsWith("image/")) setPicked(file)
            else if (file) toast.error("O arquivo precisa ser uma imagem.")
            e.target.value = ""
          }}
        />
        <AvatarCropper file={picked} onCancel={() => setPicked(null)} onConfirm={uploadCropped} />
      </div>

      <form onSubmit={saveName} className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-name">Nome</Label>
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={user.email?.split("@")[0] ?? "Seu nome"}
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-email">Email</Label>
          <Input id="account-email" value={user.email ?? ""} readOnly disabled />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={savingName}>
            {savingName ? <Loader2Icon className="animate-spin" /> : null} Salvar nome
          </Button>
        </div>
      </form>
    </Panel>
  )
}

function PasswordPanel() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {})

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
      formRef.current?.reset()
    }
  }, [state])

  return (
    <Panel title="Senha" description="Pelo menos 8 caracteres. A senha atual é conferida antes da troca.">
      <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pw-current">Senha atual</Label>
          <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pw-new">Nova senha</Label>
          <Input id="pw-new" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pw-confirm">Confirmar</Label>
          <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required />
        </div>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-3">
            {state.error}
          </p>
        ) : null}
        <div className="sm:col-span-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null} Alterar senha
          </Button>
        </div>
      </form>
    </Panel>
  )
}

const THEMES = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Escuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const

const noopSubscribe = () => () => {}

function ThemePanel() {
  const { theme, setTheme } = useTheme()
  // The saved theme is only known on the client; render no selection on the server.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const current = mounted ? (theme ?? "system") : null

  return (
    <Panel title="Aparência">
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2 sm:max-w-md">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={current === value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-20 flex-col items-center justify-center gap-2 rounded-xl border text-sm transition-colors",
              current === value
                ? "border-glass-border bg-gradient-nav-active text-foreground shadow-[var(--glass-inset)]"
                : "border-glass-border text-muted-foreground hover:bg-glass-hover hover:text-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </Panel>
  )
}
