"use client"

import { Loader2Icon, PlusIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SECTION_KEYS, SECTION_LABEL, type SectionKey } from "@/lib/ai/prompt-analysis"
import {
  countPromptFilters,
  ORIGIN_LABEL,
  promptFiltersToParams,
  STATUS_LABEL,
  TYPE_LABEL,
  type PromptFilters,
} from "@/lib/prompts/options"
import { cn } from "@/lib/utils"

export type PromptFilterOptions = {
  tools: string[]
  models: string[]
  projects: { id: string; name: string }[]
}

const ANY = "__any__"

export function PromptToolbar({
  filters,
  options,
  total,
  semantic,
}: {
  filters: PromptFilters
  options: PromptFilterOptions
  total: number
  /** False when a text query could only be matched word for word (AI unavailable). */
  semantic: boolean | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(filters.q ?? "")
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function apply(patch: Partial<PromptFilters>) {
    const qs = promptFiltersToParams({ ...filters, ...patch }).toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current)
  }, [])

  function onSearch(value: string) {
    setQ(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => apply({ q: value.trim() || undefined }), 350)
  }

  const templates = filters.aba === "modelos"
  const activeCount = countPromptFilters(filters)
  const projectName = options.projects.find((p) => p.id === filters.projeto)?.name
  const chips: { label: string; clear: () => void }[] = [
    ...(filters.ferramenta ? [{ label: filters.ferramenta, clear: () => apply({ ferramenta: undefined }) }] : []),
    ...(filters.modelo ? [{ label: filters.modelo, clear: () => apply({ modelo: undefined }) }] : []),
    ...(filters.tipo ? [{ label: TYPE_LABEL[filters.tipo], clear: () => apply({ tipo: undefined }) }] : []),
    ...(filters.estado ? [{ label: STATUS_LABEL[filters.estado], clear: () => apply({ estado: undefined }) }] : []),
    ...(filters.origem ? [{ label: ORIGIN_LABEL[filters.origem], clear: () => apply({ origem: undefined }) }] : []),
    ...(filters.projeto ? [{ label: projectName ?? "Projeto", clear: () => apply({ projeto: undefined }) }] : []),
    ...(filters.tag ? [{ label: `#${filters.tag}`, clear: () => apply({ tag: undefined }) }] : []),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <PromptTabs current={filters.aba} />

        <div className="relative max-w-md min-w-48 flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={filters.secao ? `Palavras em ${SECTION_LABEL[filters.secao]}` : "Descreva o que procura"}
            aria-label="Buscar prompts"
            className="h-11 bg-card pl-10"
          />
        </div>

        <Select value={filters.secao ?? ANY} onValueChange={(v) => apply({ secao: v === ANY ? undefined : (v as SectionKey) })}>
          <SelectTrigger className="h-11 w-40" aria-label="Onde buscar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todo o prompt</SelectItem>
            {SECTION_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                Só em {SECTION_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontalIcon /> Filtros
              {activeCount > 0 ? <Badge className="ml-0.5 h-4 min-w-4 px-1 tabular-nums">{activeCount}</Badge> : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>Combine quantos quiser.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4 pb-8">
              <Group label="Ferramenta">
                <ValueSelect items={options.tools} value={filters.ferramenta} placeholder="Qualquer ferramenta" onChange={(ferramenta) => apply({ ferramenta })} />
              </Group>
              <Group label="Modelo de IA">
                <ValueSelect items={options.models} value={filters.modelo} placeholder="Qualquer modelo" onChange={(modelo) => apply({ modelo })} />
              </Group>
              <Group label="Tipo">
                <ChoiceChips options={TYPE_LABEL} value={filters.tipo} onChange={(tipo) => apply({ tipo })} />
              </Group>
              {templates ? null : (
                <Group label="Estado">
                  <ChoiceChips options={STATUS_LABEL} value={filters.estado} onChange={(estado) => apply({ estado })} />
                </Group>
              )}
              <Group label="Origem">
                <ChoiceChips options={ORIGIN_LABEL} value={filters.origem} onChange={(origem) => apply({ origem })} />
              </Group>
              {options.projects.length > 0 ? (
                <Group label="Projeto">
                  <Select value={filters.projeto ?? ANY} onValueChange={(v) => apply({ projeto: v === ANY ? undefined : v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Qualquer projeto</SelectItem>
                      {options.projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Group>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {pending ? <Loader2Icon className="size-3 animate-spin" aria-hidden /> : null}
          {total} {templates ? (total === 1 ? "modelo" : "modelos") : total === 1 ? "prompt" : "prompts"}
        </p>

        <Button size="sm" className="ml-auto" asChild>
          <Link href={templates ? "/prompts/new?modelo=1" : "/prompts/new"}>
            <PlusIcon /> {templates ? "Novo modelo" : "Novo prompt"}
          </Link>
        </Button>
      </div>

      {semantic === false ? (
        <p className="text-xs text-muted-foreground">
          A busca por significado está indisponível agora (limite da IA). Mostrando só o que tem estas palavras.
        </p>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Badge key={c.label} variant="secondary" className="gap-1 pr-1">
              {c.label}
              <button
                type="button"
                aria-label={`Remover filtro ${c.label}`}
                onClick={c.clear}
                className="rounded-full p-0.5 hover:bg-background/50"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              apply({
                ferramenta: undefined,
                modelo: undefined,
                tipo: undefined,
                estado: undefined,
                origem: undefined,
                projeto: undefined,
                tag: undefined,
              })
            }
          >
            Limpar filtros
          </Button>
        </div>
      ) : null}
    </div>
  )
}

const TABS = [
  { aba: undefined, label: "Prompts", href: "/prompts" },
  { aba: "modelos", label: "Modelos com variáveis", href: "/prompts?aba=modelos" },
  { aba: "blocos", label: "Blocos", href: "/prompts?aba=blocos" },
] as const

/** Prompts · Modelos com variáveis · Blocos. Each tab starts without filters. */
export function PromptTabs({ current }: { current: PromptFilters["aba"] }) {
  return (
    <nav className="flex w-fit rounded-full border border-glass-border bg-glass-hover p-0.5" aria-label="Biblioteca de prompts">
      {TABS.map((t) => {
        const on = current === t.aba
        return (
          <Link
            key={t.label}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="type-label text-muted-foreground">{label}</h3>
      {children}
    </section>
  )
}

function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<T, string>
  value: T | undefined
  onChange: (value: T | undefined) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.entries(options) as [T, string][]).map(([key, label]) => {
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? undefined : key)}
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

function ValueSelect({
  items,
  value,
  placeholder,
  onChange,
}: {
  items: string[]
  value?: string
  placeholder: string
  onChange: (value: string | undefined) => void
}) {
  return (
    <Select value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? undefined : v)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{placeholder}</SelectItem>
        {items.map((i) => (
          <SelectItem key={i} value={i}>
            {i}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
