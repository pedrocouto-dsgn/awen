"use client"

import { CheckIcon, CopyIcon, KeyRoundIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TokenView } from "@/lib/validation/ext"

import { Panel } from "./panel"

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" })
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })

/** "Extensão" tab: install steps and personal tokens for the Chrome extension. */
export function ExtensionSettings({ tokens: initial, appUrl }: { tokens: TokenView[]; appUrl: string }) {
  const [tokens, setTokens] = useState(initial)
  const [created, setCreated] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Instalar"
        description="A extensão fica fora da Chrome Web Store e é instalada em modo desenvolvedor."
      >
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
          <li>
            Abra <Code>chrome://extensions</Code> e ligue o <strong className="text-foreground">Modo do desenvolvedor</strong>, no
            canto superior direito.
          </li>
          <li>
            Clique em <strong className="text-foreground">Carregar sem compactação</strong> e escolha a pasta <Code>extension</Code>{" "}
            do projeto Awen.
          </li>
          <li>Gere um token abaixo e cole-o nas opções da extensão, junto com o endereço do Awen.</li>
          <li>
            Clique com o botão direito numa imagem, num vídeo ou numa página e escolha{" "}
            <strong className="text-foreground">Salvar no Awen</strong>.
          </li>
        </ol>
        <div className="flex flex-col gap-2">
          <Label>Endereço do Awen</Label>
          <CopyField value={appUrl} />
        </div>
      </Panel>

      <Panel
        title="Tokens"
        description="Cada token dá à extensão acesso para salvar na sua biblioteca. Revogue um token se perder o dispositivo."
      >
        {created ? (
          <div className="flex flex-col gap-3 rounded-xl border border-glass-border bg-glass-hover p-4">
            <p className="text-sm text-foreground">
              Copie o token agora. Por segurança, ele não aparece de novo.
            </p>
            <CopyField value={created} />
            <div>
              <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
                Já copiei
              </Button>
            </div>
          </div>
        ) : (
          <CreateTokenForm
            onCreated={(token, view) => {
              setCreated(token)
              setTokens((list) => [view, ...list])
            }}
          />
        )}

        {tokens.length > 0 ? (
          <ul className="flex flex-col divide-y divide-glass-border">
            {tokens.map((t) => (
              <TokenRow
                key={t.id}
                token={t}
                onRevoked={() => {
                  setTokens((list) => list.filter((x) => x.id !== t.id))
                  // A just-created token that is revoked must not stay on screen.
                  setCreated(null)
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum token ainda.</p>
        )}
      </Panel>
    </div>
  )
}

function CreateTokenForm({ onCreated }: { onCreated: (token: string, view: TokenView) => void }) {
  const [name, setName] = useState("Chrome")
  const [pending, setPending] = useState(false)

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = (await res.json().catch(() => ({}))) as { token?: string; view?: TokenView; error?: string }
      if (!res.ok || !data.token || !data.view) throw new Error(data.error ?? "Não foi possível gerar o token.")
      onCreated(data.token, data.view)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o token.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="token-name">Nome do dispositivo</Label>
        <Input id="token-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
      </div>
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        {pending ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />} Gerar token
      </Button>
    </form>
  )
}

function TokenRow({ token, onRevoked }: { token: TokenView; onRevoked: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  async function revoke() {
    setPending(true)
    try {
      const res = await fetch(`/api/tokens/${token.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Token revogado.")
      onRevoked()
    } catch {
      toast.error("Não foi possível revogar o token.")
      setPending(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{token.name}</span>
        <span className="text-xs text-muted-foreground">
          <code className="font-mono">{token.prefix}…</code> · criado em {dateFormat.format(new Date(token.createdAt))} ·{" "}
          {token.lastUsedAt ? `usado em ${dateTimeFormat.format(new Date(token.lastUsedAt))}` : "nunca usado"}
        </span>
      </div>
      {confirming ? (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void revoke()} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null} Revogar
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={`Revogar ${token.name}`}>
          <Trash2Icon /> Revogar
        </Button>
      )}
    </li>
  )
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  return (
    <div className="flex gap-2">
      <Input value={value} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
        {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-glass-hover px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>
}
