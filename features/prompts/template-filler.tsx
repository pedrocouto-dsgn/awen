"use client"

import { CheckIcon, CopyIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fillTemplate, templateVariables } from "@/lib/prompts/options"

/** Fill a template's {variables}, see the result, copy it or start a prompt from it. */
export function TemplateFiller({ templateId, text }: { templateId: string; text: string }) {
  const uid = useId()
  const variables = templateVariables(text)
  const [values, setValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const filled = fillTemplate(text, values)
  const missing = variables.filter((v) => !values[v]?.trim())

  async function copy() {
    try {
      await navigator.clipboard.writeText(filled)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  const params = new URLSearchParams({ de: templateId })
  for (const v of variables) if (values[v]?.trim()) params.set(`v_${v}`, values[v]!.trim())

  if (variables.length === 0) {
    return <p className="text-xs text-muted-foreground">Este modelo não tem variáveis. Edite e escreva {"{nome}"} nos trechos que mudam.</p>
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong p-4" aria-label="Preencher modelo">
      <h2 className="type-label text-muted-foreground">Preencher</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {variables.map((v) => (
          <label key={v} htmlFor={`${uid}-${v}`} className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">{`{${v}}`}</span>
            <Input
              id={`${uid}-${v}`}
              value={values[v] ?? ""}
              onChange={(e) => setValues((cur) => ({ ...cur, [v]: e.target.value }))}
              className="h-9"
            />
          </label>
        ))}
      </div>
      <pre className="max-h-64 overflow-y-auto rounded-xl border border-glass-border bg-background/40 p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">
        {filled}
      </pre>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant={copied ? "secondary" : "outline"} onClick={() => void copy()}>
          {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copiado" : "Copiar preenchido"}
        </Button>
        <Button size="xs" variant="outline" asChild>
          <Link href={`/prompts/new?${params}`}>
            <PlusIcon /> Criar prompt com estes valores
          </Link>
        </Button>
        {missing.length > 0 ? (
          <span className="text-xs text-muted-foreground">Faltam: {missing.map((v) => `{${v}}`).join(", ")}</span>
        ) : null}
      </div>
    </section>
  )
}
