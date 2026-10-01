"use client"

import { ImagePlusIcon, LibraryIcon, Loader2Icon, PlayIcon, UploadIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { apiJson } from "@/features/ingest/upload"
import { TagInput } from "@/features/review/components/fields"
import { LOCAL_DROP_ATTR } from "@/lib/library/drag"
import type { PromptAssetView, PromptView } from "@/lib/prompts/data"
import {
  ORIGIN_LABEL,
  PARAM_FIELDS,
  STATUS_LABEL,
  templateVariables,
  TYPE_LABEL,
  type PromptOrigin,
  type PromptParams,
  type PromptStatus,
  type PromptType,
} from "@/lib/prompts/options"
import { cn } from "@/lib/utils"

import { ReferencePicker, type PickedReference } from "./reference-picker"
import { addReferenceAsset, removeAsset, uploadPromptAsset, type AssetRole } from "./upload-asset"

const NONE = "__none__"

/** A result or input in the form: already saved, a new file, or a library reference to add. */
type FormAsset =
  | { key: string; state: "saved"; role: AssetRole; view: PromptAssetView }
  | { key: string; state: "file"; role: AssetRole; file: File; previewUrl: string | null; progress: number | null; error?: string }
  | { key: string; state: "reference"; role: AssetRole; ref: PickedReference }

type Draft = {
  prompt_text: string
  title: string
  tool: string
  model: string
  type: PromptType | null
  status: PromptStatus | null
  origin: PromptOrigin
  author: string
  source_url: string
  notes: string
  version_note: string
  tags: string[]
  params: PromptParams
  is_template: boolean
}

type Props = {
  /** Editing this prompt; null creates a new one. */
  prompt: PromptView | null
  /** Creating a new version of this prompt (prefilled from it). */
  parent?: PromptView | null
  /** Start as a template (from the "Modelos com variáveis" tab). */
  template?: boolean
  /** Preselected inspiring reference (from a reference's page). */
  initialReference?: PickedReference | null
  suggestions: { tools: string[]; models: string[] }
  projects: { id: string; name: string }[]
}

function draftFrom(p: PromptView | null | undefined): Draft {
  return {
    prompt_text: p?.prompt_text ?? "",
    title: p?.title ?? "",
    tool: p?.tool ?? "",
    model: p?.model ?? "",
    type: p?.type ?? null,
    status: p?.status ?? null,
    origin: p?.origin ?? "own",
    author: p?.author ?? "",
    source_url: p?.source_url ?? "",
    notes: p?.notes ?? "",
    version_note: p?.version_note ?? "",
    tags: p?.tags ?? [],
    params: p?.params ?? {},
    is_template: p?.is_template ?? false,
  }
}

export function PromptForm({ prompt, parent, template = false, initialReference, suggestions, projects }: Props) {
  const router = useRouter()
  const uid = useId()
  const source = prompt ?? parent ?? null
  const isVersion = !prompt && Boolean(parent)

  const [draft, setDraft] = useState<Draft>(() => ({
    ...draftFrom(source),
    version_note: prompt?.version_note ?? "",
    is_template: source?.is_template ?? template,
  }))
  // A new version starts with the parent's inputs (the same sources), but its own results.
  const [assets, setAssets] = useState<FormAsset[]>(() =>
    prompt
      ? [...prompt.results, ...prompt.inputs].map((view) => ({ key: view.id, state: "saved", role: view.role, view }))
      : (parent?.inputs ?? [])
          .filter((v) => v.reference)
          .map((v) => ({
            key: v.id,
            state: "reference" as const,
            role: "input" as const,
            ref: { id: v.reference!.id, title: v.reference!.title, thumbUrl: v.thumbUrl, type: v.kind },
          })),
  )
  const [removed, setRemoved] = useState<string[]>([])
  const [inspired, setInspired] = useState<PickedReference[]>(() =>
    source
      ? source.references.map((r) => ({ ...r, type: "image" as const }))
      : initialReference
        ? [initialReference]
        : [],
  )
  const [projectIds, setProjectIds] = useState<string[]>(() => source?.projects.map((p) => p.id) ?? [])
  const [picker, setPicker] = useState<null | "result" | "input" | "inspired">(null)
  const [saving, setSaving] = useState(false)
  // Once created, later saves update the same entry (e.g. after a failed upload).
  const [savedId, setSavedId] = useState<string | null>(prompt?.id ?? null)
  const [dragOver, setDragOver] = useState<AssetRole | null>(null)

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const results = assets.filter((a) => a.role === "result")
  const inputs = assets.filter((a) => a.role === "input")
  const variables = draft.is_template ? templateVariables(draft.prompt_text) : []

  // Revoke object URLs of pending files when they leave the form.
  const urls = useRef(new Set<string>())
  useEffect(() => {
    const live = urls.current
    return () => live.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  function addFiles(role: AssetRole, files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
    if (list.length === 0) {
      toast.error("Use imagens ou vídeos.")
      return
    }
    setAssets((a) => [
      ...a,
      ...list.map((file): FormAsset => {
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null
        if (previewUrl) urls.current.add(previewUrl)
        return { key: crypto.randomUUID(), state: "file", role, file, previewUrl, progress: null }
      }),
    ])
  }

  function dropAsset(asset: FormAsset) {
    setAssets((a) => a.filter((x) => x.key !== asset.key))
    if (asset.state === "saved") setRemoved((r) => [...r, asset.view.id])
  }

  async function save() {
    if (!draft.prompt_text.trim()) {
      toast.error("Escreva ou cole o prompt.")
      return
    }
    if (!draft.is_template && results.length === 0) {
      toast.error("Adicione o resultado (imagem ou vídeo gerado).")
      return
    }
    setSaving(true)
    try {
      const body = JSON.stringify({
        ...draft,
        referenceIds: inspired.map((r) => r.id),
        projectIds,
        ...(savedId ? {} : { parentId: parent?.id ?? null }),
      })
      let id = savedId
      if (id) {
        await apiJson(`/api/prompts/${id}`, { method: "PATCH", body })
      } else {
        id = (await apiJson<{ id: string }>("/api/prompts", { method: "POST", body })).id
        setSavedId(id)
      }

      for (const assetId of removed) await removeAsset(id, assetId)
      setRemoved([])

      let failed = 0
      for (const asset of assets) {
        if (asset.state === "saved") continue
        try {
          if (asset.state === "reference") {
            const assetId = await addReferenceAsset(id, asset.role, asset.ref.id)
            markSaved(asset.key, assetId)
          } else {
            const assetId = await uploadPromptAsset(id, asset.role, asset.file, (progress) =>
              setAssets((a) => a.map((x) => (x.key === asset.key ? { ...x, progress } : x)) as FormAsset[]),
            )
            markSaved(asset.key, assetId)
          }
        } catch (error) {
          failed += 1
          const message = error instanceof Error ? error.message : "Falha no envio."
          setAssets((a) => a.map((x) => (x.key === asset.key ? { ...x, progress: null, error: message } : x)) as FormAsset[])
        }
      }

      if (failed > 0) {
        toast.error(
          failed === 1 ? "Um arquivo não foi enviado. Tente salvar de novo." : `${failed} arquivos não foram enviados. Tente salvar de novo.`,
        )
        return
      }
      toast.success(prompt ? "Prompt salvo." : isVersion ? "Nova versão salva." : "Prompt criado.")
      router.push(`/prompts/${id}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  // Saved assets become "saved" placeholders so a retry does not upload them twice.
  function markSaved(key: string, assetId: string) {
    setAssets((a) =>
      a.map((x) =>
        x.key === key && x.state !== "saved"
          ? {
              key,
              state: "saved",
              role: x.role,
              view: {
                id: assetId,
                role: x.role,
                kind: x.state === "file" ? (x.file.type.startsWith("video/") ? "video" : "image") : x.ref.type,
                src: null,
                thumbUrl: x.state === "file" ? x.previewUrl : x.ref.thumbUrl,
                width: null,
                height: null,
                ready: true,
                reference: x.state === "reference" ? { id: x.ref.id, title: x.ref.title } : null,
              },
            }
          : x,
      ),
    )
  }

  const assetZone = (role: AssetRole, list: FormAsset[]) => (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong p-4 transition-colors",
        dragOver === role && "border-ring bg-glass-hover",
      )}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return
        e.preventDefault()
        setDragOver(role)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        e.stopPropagation()
        setDragOver(null)
        addFiles(role, e.dataTransfer.files)
      }}
    >
      {list.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {list.map((a) => (
            <AssetTile key={a.key} asset={a} disabled={saving} onRemove={() => dropAsset(a)} />
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <UploadIcon className="size-4" aria-hidden />
          {role === "result"
            ? "Arraste aqui a imagem ou o vídeo que o prompt gerou."
            : "Arraste aqui o first frame ou as imagens usadas como referência."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <FileButton label="Enviar arquivo" disabled={saving} onFiles={(f) => addFiles(role, f)} />
        <Button type="button" variant="outline" size="xs" disabled={saving} onClick={() => setPicker(role)}>
          <LibraryIcon /> Da biblioteca
        </Button>
      </div>
    </div>
  )

  return (
    <form
      {...{ [LOCAL_DROP_ATTR]: "" }}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      // Files dropped anywhere on the form become results, not library references.
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        e.stopPropagation()
        addFiles("result", e.dataTransfer.files)
      }}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="flex flex-col gap-6">
        <Field label="Prompt" htmlFor={`${uid}-text`} hint={`${draft.prompt_text.length.toLocaleString("pt-BR")} caracteres`}>
          <Textarea
            id={`${uid}-text`}
            value={draft.prompt_text}
            onChange={(e) => patch({ prompt_text: e.target.value })}
            placeholder={draft.is_template ? "Use {variavel} nos trechos que mudam, ex.: A {subject} in {location}" : "Cole o prompt completo"}
            className="max-h-[60svh] min-h-64 font-mono text-[13px] leading-relaxed"
            autoFocus={!source}
          />
        </Field>

        <label className="flex items-start gap-3 text-sm">
          <Switch checked={draft.is_template} onCheckedChange={(is_template) => patch({ is_template })} className="mt-0.5" />
          <span className="flex flex-col gap-1">
            <span>Modelo com variáveis</span>
            <span className="text-xs text-muted-foreground">
              {draft.is_template
                ? variables.length
                  ? `Variáveis: ${variables.map((v) => `{${v}}`).join(", ")}`
                  : "Nenhuma variável ainda. Escreva {nome} no texto."
                : "Uma estrutura para reutilizar, trocando só os campos entre chaves. Não precisa de resultado."}
            </span>
          </span>
        </label>

        <Field label={draft.is_template ? "Exemplo de resultado (opcional)" : "Resultado"}>{assetZone("result", results)}</Field>
        <Field label="Entradas (opcional)">{assetZone("input", inputs)}</Field>
      </div>

      <div className="flex flex-col gap-6">
        <Field label="Título (opcional)" htmlFor={`${uid}-title`}>
          <Input
            id={`${uid}-title`}
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Para achar depois, ex.: Cavaleiro no deserto"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Ferramenta" htmlFor={`${uid}-tool`}>
            <Input
              id={`${uid}-tool`}
              list={`${uid}-tools`}
              value={draft.tool}
              onChange={(e) => patch({ tool: e.target.value })}
              placeholder="Higgsfield"
            />
            <datalist id={`${uid}-tools`}>
              {suggestions.tools.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Modelo de IA" htmlFor={`${uid}-model`}>
            <Input
              id={`${uid}-model`}
              list={`${uid}-models`}
              value={draft.model}
              onChange={(e) => patch({ model: e.target.value })}
              placeholder="Kling"
            />
            <datalist id={`${uid}-models`}>
              {suggestions.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Tipo" htmlFor={`${uid}-type`}>
          <Select value={draft.type ?? NONE} onValueChange={(v) => patch({ type: v === NONE ? null : (v as PromptType) })}>
            <SelectTrigger id={`${uid}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Parâmetros (opcionais)">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PARAM_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <Input
                  value={draft.params[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => patch({ params: { ...draft.params, [f.key]: e.target.value } })}
                  className="h-9"
                />
              </label>
            ))}
          </div>
        </Field>

        {draft.is_template ? null : (
          <Field label="Estado">
            <Chips
              options={Object.entries(STATUS_LABEL) as [PromptStatus, string][]}
              value={draft.status}
              onChange={(status) => patch({ status })}
            />
          </Field>
        )}

        <Field label="Origem">
          <Chips
            options={Object.entries(ORIGIN_LABEL) as [PromptOrigin, string][]}
            value={draft.origin}
            onChange={(origin) => patch({ origin: origin ?? "own" })}
          />
          {draft.origin === "third_party" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input value={draft.author} onChange={(e) => patch({ author: e.target.value })} placeholder="Autor" aria-label="Autor" />
              <Input
                value={draft.source_url}
                onChange={(e) => patch({ source_url: e.target.value })}
                placeholder="Link da página"
                aria-label="Link da página"
                inputMode="url"
              />
            </div>
          ) : null}
        </Field>

        {isVersion || prompt?.parent_prompt_id ? (
          <Field label="O que mudou nesta versão" htmlFor={`${uid}-vnote`}>
            <Textarea
              id={`${uid}-vnote`}
              rows={2}
              value={draft.version_note}
              onChange={(e) => patch({ version_note: e.target.value })}
              placeholder="Ex.: troquei a luz para contraluz e tirei o grão"
            />
          </Field>
        ) : null}

        <Field label="Notas" htmlFor={`${uid}-notes`}>
          <Textarea
            id={`${uid}-notes`}
            rows={3}
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="O que funcionou e o que ajustar"
          />
        </Field>

        <Field label="Tags" htmlFor={`${uid}-tags`}>
          <TagInput id={`${uid}-tags`} value={draft.tags} onChange={(tags) => patch({ tags })} />
        </Field>

        <Field label="Referências que inspiraram">
          {inspired.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {inspired.map((r) => (
                <li key={r.id} className="group relative size-16 overflow-hidden rounded-lg bg-media">
                  {r.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
                    <img src={r.thumbUrl} alt={r.title ?? ""} title={r.title ?? undefined} className="size-full object-cover" />
                  ) : null}
                  <RemoveButton label={`Remover ${r.title ?? "referência"}`} onClick={() => setInspired((l) => l.filter((x) => x.id !== r.id))} />
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <Button type="button" variant="outline" size="xs" onClick={() => setPicker("inspired")}>
              <ImagePlusIcon /> Escolher na biblioteca
            </Button>
          </div>
        </Field>

        {projects.length > 0 ? (
          <Field label="Usado nos projetos">
            <div className="flex flex-wrap gap-1.5">
              {projects.map((p) => {
                const on = projectIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setProjectIds((ids) => (on ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                    className={cn(
                      "type-label rounded-sm border px-3 py-1.5 transition-colors",
                      on
                        ? "border-transparent bg-gradient-steel text-foreground"
                        : "border-border-strong text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
          </Field>
        ) : null}

        <div className="glass-strong sticky bottom-4 flex items-center justify-end gap-2 rounded-2xl px-3 py-2.5">
          <Button type="button" variant="ghost" asChild>
            <Link href={savedId ? `/prompts/${savedId}` : "/prompts"}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            {prompt ? "Salvar" : isVersion ? "Salvar versão" : "Salvar prompt"}
          </Button>
        </div>
      </div>

      <ReferencePicker
        open={picker !== null}
        onOpenChange={(open) => !open && setPicker(null)}
        title={
          picker === "inspired"
            ? "Referências que inspiraram"
            : picker === "result"
              ? "Resultado da biblioteca"
              : "Entradas da biblioteca"
        }
        description={
          picker === "inspired"
            ? "As referências em que o prompt se baseou. Na página de cada uma, este prompt aparece."
            : "Use uma referência que já está na biblioteca, sem enviar o arquivo de novo."
        }
        exclude={
          picker === "inspired"
            ? inspired.map((r) => r.id)
            : assets.flatMap((a) =>
                a.role === picker
                  ? a.state === "reference"
                    ? [a.ref.id]
                    : a.state === "saved" && a.view.reference
                      ? [a.view.reference.id]
                      : []
                  : [],
              )
        }
        onPick={(refs) => {
          if (picker === "inspired") setInspired((l) => [...l, ...refs])
          else if (picker)
            setAssets((a) => [
              ...a,
              ...refs.map((ref): FormAsset => ({ key: crypto.randomUUID(), state: "reference", role: picker, ref })),
            ])
        }}
      />
    </form>
  )
}

function AssetTile({ asset, disabled, onRemove }: { asset: FormAsset; disabled: boolean; onRemove: () => void }) {
  const thumb =
    asset.state === "saved" ? asset.view.thumbUrl : asset.state === "file" ? asset.previewUrl : asset.ref.thumbUrl
  const isVideo =
    asset.state === "saved"
      ? asset.view.kind === "video"
      : asset.state === "file"
        ? asset.file.type.startsWith("video/")
        : asset.ref.type === "video"
  const label =
    asset.state === "file" ? asset.file.name : asset.state === "reference" ? asset.ref.title : asset.view.reference?.title

  return (
    <li className="relative aspect-square overflow-hidden rounded-lg bg-media" title={label ?? undefined}>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned or local preview URL
        <img src={thumb} alt={label ?? ""} className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center p-2 text-center text-[11px] break-all text-muted-foreground">
          {label}
        </span>
      )}
      {isVideo ? (
        <PlayIcon className="absolute bottom-1.5 left-1.5 size-3.5 fill-current text-scrim-foreground drop-shadow" aria-hidden />
      ) : null}
      {asset.state === "reference" || (asset.state === "saved" && asset.view.reference) ? (
        <Badge variant="secondary" className="absolute bottom-1.5 left-1.5 h-4 px-1 text-[9px]">
          Biblioteca
        </Badge>
      ) : null}
      {asset.state === "file" && asset.progress !== null ? (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-overlay/50">
          <span className="block h-full bg-primary transition-[width]" style={{ width: `${asset.progress}%` }} />
        </span>
      ) : null}
      {asset.state === "file" && asset.error ? (
        <span role="alert" className="absolute inset-x-0 bottom-0 bg-destructive/90 px-1.5 py-1 text-[10px] leading-tight text-background">
          {asset.error}
        </span>
      ) : null}
      {disabled ? null : <RemoveButton label={`Remover ${label ?? "arquivo"}`} onClick={onRemove} />}
    </li>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-overlay/70 text-scrim-foreground backdrop-blur-sm"
    >
      <XIcon className="size-3.5" />
    </button>
  )
}

function FileButton({ label, disabled, onFiles }: { label: string; disabled: boolean; onFiles: (files: FileList) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button type="button" variant="outline" size="xs" disabled={disabled} onClick={() => ref.current?.click()}>
        <UploadIcon /> {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ""
        }}
      />
    </>
  )
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][]
  value: T | null
  onChange: (value: T | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([key, label]) => {
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : key)}
            className={cn(
              "type-label rounded-sm border px-3 py-1.5 transition-colors",
              on
                ? "border-transparent bg-gradient-steel text-foreground"
                : "border-border-strong text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="type-label text-muted-foreground">
            {label}
          </label>
        ) : (
          <span className="type-label text-muted-foreground">{label}</span>
        )}
        {hint ? <span className="text-xs text-muted-foreground tabular-nums">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}
