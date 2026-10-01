import Link from "next/link"

import type { PromptView } from "@/lib/prompts/data"
import { diffText, type DiffPart } from "@/lib/prompts/diff"
import { ORIGIN_LABEL, PARAM_FIELDS, STATUS_LABEL, TYPE_LABEL } from "@/lib/prompts/options"
import { cn } from "@/lib/utils"

/** Two prompts side by side: results, text with word-level changes, and the fields that differ. */
export function PromptCompare({ before, after }: { before: PromptView; after: PromptView }) {
  const parts = diffText(before.prompt_text, after.prompt_text)
  const changed = parts.some((p) => p.kind !== "same")

  const rows: { label: string; a: string | null; b: string | null }[] = [
    { label: "Modelo de IA", a: before.model, b: after.model },
    { label: "Ferramenta", a: before.tool, b: after.tool },
    { label: "Tipo", a: before.type && TYPE_LABEL[before.type], b: after.type && TYPE_LABEL[after.type] },
    { label: "Estado", a: before.status && STATUS_LABEL[before.status], b: after.status && STATUS_LABEL[after.status] },
    ...PARAM_FIELDS.map((f) => ({ label: f.label, a: before.params[f.key] ?? null, b: after.params[f.key] ?? null })),
    { label: "Origem", a: ORIGIN_LABEL[before.origin], b: ORIGIN_LABEL[after.origin] },
    { label: "Tags", a: before.tags.join(", ") || null, b: after.tags.join(", ") || null },
    { label: "Notas", a: before.notes, b: after.notes },
  ].filter((r) => r.a || r.b)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Side prompt={before} />
        <Side prompt={after} />
      </div>

      <section className="flex flex-col gap-3" aria-label="Diferenças no texto">
        <div className="flex items-baseline gap-3">
          <h2 className="type-label text-muted-foreground">Texto</h2>
          {changed ? (
            <p className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-sm bg-destructive/20 px-1 text-foreground line-through">removido</span>
              <span className="rounded-sm bg-success/25 px-1 text-foreground">adicionado</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">O texto é igual nas duas versões.</p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DiffPane parts={parts} show="removed" />
          <DiffPane parts={parts} show="added" />
        </div>
      </section>

      {rows.length > 0 ? (
        <section className="flex flex-col gap-3" aria-label="Diferenças nos campos">
          <h2 className="type-label text-muted-foreground">Campos</h2>
          <div className="glass overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <tbody>
                {rows.map((r) => {
                  const diff = (r.a ?? "") !== (r.b ?? "")
                  return (
                    <tr key={r.label} className="border-b border-glass-border last:border-b-0">
                      <th scope="row" className="type-label w-36 px-4 py-2.5 text-left align-top font-normal text-muted-foreground">
                        {r.label}
                      </th>
                      <td className={cn("px-4 py-2.5 align-top whitespace-pre-wrap", diff && "bg-destructive/10")}>{r.a ?? "—"}</td>
                      <td className={cn("px-4 py-2.5 align-top whitespace-pre-wrap", diff && "bg-success/10")}>{r.b ?? "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Side({ prompt }: { prompt: PromptView }) {
  const result = prompt.results[0]
  const version = prompt.versions.find((v) => v.id === prompt.id)
  return (
    <article className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-media">
        {result?.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
          <img src={result.thumbUrl} alt="" className="absolute inset-0 size-full object-contain" />
        ) : (
          <span className="flex size-full items-center justify-center text-sm text-muted-foreground">Sem resultado</span>
        )}
      </div>
      <Link href={`/prompts/${prompt.id}`} className="flex items-baseline gap-2 text-sm hover:underline">
        {version ? <span className="font-semibold tabular-nums">v{version.number}</span> : null}
        <span className="truncate text-muted-foreground">
          {version?.note ?? (version?.number === 1 ? "Original" : (prompt.title ?? "Prompt"))}
        </span>
      </Link>
    </article>
  )
}

function DiffPane({ parts, show }: { parts: DiffPart[]; show: "removed" | "added" }) {
  return (
    <pre className="glass max-h-[60svh] overflow-y-auto rounded-2xl p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.kind === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.kind === show ? (
          <mark
            key={i}
            className={cn(
              "rounded-sm text-foreground",
              show === "removed" ? "bg-destructive/20 line-through decoration-destructive/60" : "bg-success/25",
            )}
          >
            {p.text}
          </mark>
        ) : null,
      )}
    </pre>
  )
}
