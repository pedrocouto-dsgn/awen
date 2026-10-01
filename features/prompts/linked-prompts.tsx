import { PlusIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { PromptCard } from "@/lib/prompts/data"

/** Compact list of prompts linked to a reference (detail side panel). */
export function LinkedPrompts({ prompts, referenceId }: { prompts: PromptCard[]; referenceId: string }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label="Prompts">
      <div className="h-px bg-gradient-hairline" aria-hidden />
      <h3 className="type-label pt-4 text-muted-foreground">Prompts</h3>
      {prompts.length > 0 ? (
        <ul className="flex flex-col">
          {prompts.map((p) => (
            <li key={p.id} className="border-b last:border-b-0">
              <Link href={`/prompts/${p.id}`} className="flex items-center gap-3 py-2 hover:underline">
                <span className="size-10 shrink-0 overflow-hidden rounded-md bg-media">
                  {p.result?.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
                    <img src={p.result.thumbUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{p.title ?? p.excerpt}</span>
                  {p.model || p.tool ? (
                    <span className="truncate text-xs text-muted-foreground">{[p.model, p.tool].filter(Boolean).join(" · ")}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum prompt recriou esta referência ainda.</p>
      )}
      <div>
        <Button variant="outline" size="xs" asChild>
          <Link href={`/prompts/new?referencia=${referenceId}`}>
            <PlusIcon /> Novo prompt a partir desta
          </Link>
        </Button>
      </div>
    </section>
  )
}
