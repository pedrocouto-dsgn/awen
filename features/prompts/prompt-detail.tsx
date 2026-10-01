"use client"

import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GitBranchPlusIcon,
  ImageOffIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shell/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { PromptAssetView, PromptView } from "@/lib/prompts/data"
import { ORIGIN_LABEL, PARAM_FIELDS, STATUS_LABEL, TYPE_LABEL } from "@/lib/prompts/options"
import { cn } from "@/lib/utils"

import { TemplateText } from "./prompt-grid"

export function PromptDetail({ prompt }: { prompt: PromptView }) {
  const router = useRouter()
  const [current, setCurrent] = useState(prompt.results[0] ?? prompt.inputs[0] ?? null)
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const version = prompt.versions.find((v) => v.id === prompt.id)

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  async function remove() {
    const res = await fetch(`/api/prompts/${prompt.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Não foi possível excluir.")
      return
    }
    toast.success("Prompt excluído.")
    router.push("/prompts")
    router.refresh()
  }

  const params = PARAM_FIELDS.filter((f) => prompt.params[f.key])
  const hasMedia = prompt.results.length + prompt.inputs.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 pt-0 lg:flex-row lg:overflow-hidden">
      {hasMedia ? (
        <section aria-label="Resultado e entradas" className="flex shrink-0 flex-col gap-3 lg:min-h-0 lg:min-w-0 lg:flex-1">
          <div className="relative h-[55svh] overflow-hidden rounded-2xl bg-media lg:h-auto lg:min-h-0 lg:flex-1">
            {current ? <Stage asset={current} /> : null}
          </div>
          <AssetStrip label="Resultado" assets={prompt.results} current={current} onSelect={setCurrent} />
          <AssetStrip label="Entradas" assets={prompt.inputs} current={current} onSelect={setCurrent} />
        </section>
      ) : null}

      <aside
        aria-label="Prompt"
        className={cn(
          "glass flex min-h-0 w-full flex-col overflow-hidden rounded-2xl",
          hasMedia ? "lg:w-[480px]" : "mx-auto max-w-3xl lg:flex-1",
        )}
      >
        <div className="flex items-center gap-2 border-b border-glass-border px-4 py-2">
          {prompt.is_template ? <Badge variant="outline">Modelo com variáveis</Badge> : null}
          {prompt.versions.length > 1 && version ? <Badge variant="outline">v{version.number}</Badge> : null}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/prompts/new?versao=${prompt.id}`}>
                <GitBranchPlusIcon /> Nova versão
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/prompts/${prompt.id}/edit`}>
                <PencilIcon /> Editar
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  <Trash2Icon /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
          {prompt.title ? <h1 className="text-xl font-medium tracking-tight">{prompt.title}</h1> : null}

          <section aria-label="Texto do prompt" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="type-label text-muted-foreground">Prompt</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {prompt.prompt_text.length.toLocaleString("pt-BR")} caracteres
              </span>
              <Button size="xs" variant={copied ? "secondary" : "outline"} className="ml-auto" onClick={() => void copy()}>
                {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <pre className="max-h-[50svh] overflow-y-auto rounded-xl border border-glass-border bg-background/40 p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">
              {prompt.is_template ? <TemplateText text={prompt.prompt_text} /> : prompt.prompt_text}
            </pre>
          </section>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Item label="Modelo de IA">{prompt.model}</Item>
            <Item label="Ferramenta">{prompt.tool}</Item>
            <Item label="Tipo">{prompt.type ? TYPE_LABEL[prompt.type] : null}</Item>
            {prompt.is_template ? null : <Item label="Estado">{prompt.status ? STATUS_LABEL[prompt.status] : null}</Item>}
            {params.map((f) => (
              <Item key={f.key} label={f.label}>
                {prompt.params[f.key]}
              </Item>
            ))}
            <Item label="Origem">
              {ORIGIN_LABEL[prompt.origin]}
              {prompt.origin === "third_party" && prompt.author ? ` · ${prompt.author}` : ""}
            </Item>
            {prompt.origin === "third_party" && prompt.source_url ? (
              <Item label="Link">
                <a
                  href={prompt.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 truncate hover:underline"
                >
                  <span className="truncate">{new URL(prompt.source_url).host}</span>
                  <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
                </a>
              </Item>
            ) : null}
          </dl>

          {prompt.notes ? (
            <Block label="Notas">
              <p className="text-sm whitespace-pre-wrap">{prompt.notes}</p>
            </Block>
          ) : null}

          {prompt.tags.length > 0 ? (
            <Block label="Tags">
              <div className="flex flex-wrap gap-1.5">
                {prompt.tags.map((t) => (
                  <Badge key={t} variant="secondary" asChild>
                    <Link href={`/prompts?tag=${encodeURIComponent(t)}`}>{t}</Link>
                  </Badge>
                ))}
              </div>
            </Block>
          ) : null}

          {prompt.versions.length > 1 ? (
            <Block label="Versões">
              <ol className="flex flex-col">
                {prompt.versions.map((v) => (
                  <li key={v.id} className="border-b py-2 last:border-b-0">
                    <Link
                      href={`/prompts/${v.id}`}
                      aria-current={v.id === prompt.id ? "page" : undefined}
                      className={cn("flex items-baseline gap-2 text-sm", v.id === prompt.id ? "font-semibold" : "hover:underline")}
                    >
                      <span className="tabular-nums">v{v.number}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{v.note ?? (v.number === 1 ? "Original" : "Sem nota")}</span>
                      <time className="shrink-0 text-xs text-muted-foreground" dateTime={v.createdAt}>
                        {new Date(v.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </time>
                    </Link>
                  </li>
                ))}
              </ol>
            </Block>
          ) : null}

          {prompt.references.length > 0 ? (
            <Block label="Referências que inspiraram">
              <ul className="flex flex-wrap gap-2">
                {prompt.references.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/library/${r.id}`}
                      title={r.title ?? undefined}
                      className="block size-16 overflow-hidden rounded-lg bg-media ring-ring hover:ring-2"
                    >
                      {r.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
                        <img src={r.thumbUrl} alt={r.title ?? ""} className="size-full object-cover" />
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {prompt.projects.length > 0 ? (
            <Block label="Usado nos projetos">
              <ul className="flex flex-wrap gap-1.5">
                {prompt.projects.map((p) => (
                  <li key={p.id}>
                    <Badge variant="outline" asChild>
                      <Link href={`/projects/${p.id}`}>{p.name}</Link>
                    </Badge>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
        </div>
      </aside>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir este prompt?"
        description="O texto, o resultado e as entradas enviadas são apagados. Referências da biblioteca não são afetadas."
        confirmLabel="Excluir"
        onConfirm={remove}
      />
    </div>
  )
}

function Stage({ asset }: { asset: PromptAssetView }) {
  if (!asset.ready) {
    return <p className="flex size-full items-center justify-center text-sm text-muted-foreground">Envio não concluído.</p>
  }
  if (asset.kind === "video" && asset.src) {
    return (
      <video
        key={asset.src}
        src={asset.src}
        poster={asset.thumbUrl ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="absolute inset-0 size-full object-contain"
      />
    )
  }
  const src = asset.src ?? asset.thumbUrl
  if (!src) {
    return (
      <span className="flex size-full items-center justify-center text-muted-foreground">
        <ImageOffIcon className="size-6" aria-hidden />
      </span>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
  return <img src={src} alt="" className="absolute inset-0 size-full object-contain" decoding="async" />
}

function AssetStrip({
  label,
  assets,
  current,
  onSelect,
}: {
  label: string
  assets: PromptAssetView[]
  current: PromptAssetView | null
  onSelect: (a: PromptAssetView) => void
}) {
  if (assets.length === 0) return null
  // A single result needs no strip, unless there are inputs to switch to.
  return (
    <div className="flex items-center gap-3 overflow-x-auto px-1">
      <span className="type-label shrink-0 text-muted-foreground">{label}</span>
      <ul className="flex gap-2">
        {assets.map((a) => (
          <li key={a.id} className="relative">
            <button
              type="button"
              onClick={() => onSelect(a)}
              aria-pressed={current?.id === a.id}
              aria-label={a.reference?.title ?? label}
              className={cn(
                "relative block size-14 overflow-hidden rounded-lg bg-media",
                current?.id === a.id && "ring-2 ring-ring ring-offset-2 ring-offset-background",
              )}
            >
              {a.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
                <img src={a.thumbUrl} alt="" className="size-full object-cover" />
              ) : null}
              {a.kind === "video" ? (
                <PlayIcon className="absolute bottom-1 left-1 size-3 fill-current text-scrim-foreground drop-shadow" aria-hidden />
              ) : null}
            </button>
            {a.reference ? (
              <Link
                href={`/library/${a.reference.id}`}
                className="mt-1 block max-w-14 truncate text-[10px] text-muted-foreground hover:underline"
                title={a.reference.title ?? "Abrir na biblioteca"}
              >
                Biblioteca
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="type-label text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="type-label text-muted-foreground">{label}</h2>
      {children}
    </section>
  )
}
