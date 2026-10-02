"use client"

import { CheckIcon, CopyIcon, PlusIcon, SparklesIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useOptionalAnalysis } from "@/features/analysis/analysis-provider"
import { apiJson } from "@/features/ingest/upload"
import { SECTION_KEYS, SECTION_LABEL, type SectionKey } from "@/lib/ai/prompt-analysis"
import type { PromptView } from "@/lib/prompts/data"

/** The prompt split into sections by the AI (fragments copied from the text), each searchable. */
export function PromptSections({ prompt }: { prompt: PromptView }) {
  const keys = SECTION_KEYS.filter((k) => prompt.sections[k])

  if (!prompt.analyzed_at) {
    return (
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <SparklesIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {prompt.analysis_error
          ? "A IA não conseguiu ler este prompt agora. Ela tenta de novo em algumas horas."
          : "A IA vai separar este prompt em seções (câmera, luz, estilo…) e sugerir tags em instantes."}
      </p>
    )
  }
  if (keys.length === 0) return null

  return (
    <section className="flex flex-col gap-2" aria-label="Seções">
      <h2 className="type-label flex items-center gap-1.5 text-muted-foreground">
        <SparklesIcon className="size-3" aria-hidden /> Seções
      </h2>
      <dl className="flex flex-col">
        {keys.map((k) => (
          <SectionRow key={k} sectionKey={k} text={prompt.sections[k]!} />
        ))}
      </dl>
    </section>
  )
}

function SectionRow({ sectionKey, text }: { sectionKey: SectionKey; text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group flex flex-col gap-1 border-b py-2 last:border-b-0">
      <dt className="flex items-center gap-2">
        <Link
          href={`/prompts?secao=${sectionKey}`}
          className="type-label text-muted-foreground hover:text-foreground"
          title={`Ver prompts com ${SECTION_LABEL[sectionKey]}`}
        >
          {SECTION_LABEL[sectionKey]}
        </Link>
        <button
          type="button"
          aria-label={`Copiar ${SECTION_LABEL[sectionKey]}`}
          onClick={() =>
            void navigator.clipboard.writeText(text).then(
              () => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              },
              () => toast.error("Não foi possível copiar."),
            )
          }
          className="ml-auto text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
        >
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        </button>
      </dt>
      <dd className="font-mono text-xs leading-relaxed whitespace-pre-wrap">{text}</dd>
    </div>
  )
}

/** AI tag suggestions; each one is added only when accepted. */
export function SuggestedTags({ promptId, tags }: { promptId: string; tags: string[] }) {
  const router = useRouter()
  const analysis = useOptionalAnalysis()
  const [pending, setPending] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<string[]>([])
  const visible = tags.filter((t) => !accepted.includes(t))
  if (visible.length === 0) return null

  async function accept(tag: string) {
    setPending(tag)
    try {
      await apiJson(`/api/prompts/${promptId}/tags`, { method: "POST", body: JSON.stringify({ tag }) })
      setAccepted((a) => [...a, tag])
      router.refresh()
      // New tags change the search vector: let the worker redo it now.
      analysis?.kick()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar a tag.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <SparklesIcon className="size-3" aria-hidden /> Sugestões:
      </span>
      {visible.map((t) => (
        <Button
          key={t}
          variant="outline"
          size="xs"
          disabled={pending !== null}
          onClick={() => void accept(t)}
          aria-label={`Adicionar a tag ${t}`}
        >
          <PlusIcon /> {t}
        </Button>
      ))}
    </div>
  )
}
