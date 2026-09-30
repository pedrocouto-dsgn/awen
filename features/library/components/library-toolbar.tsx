"use client"

import { Loader2Icon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  ASPECT_BUCKETS,
  countActiveFilters,
  filtersToParams,
  SINCE_OPTIONS,
  SOURCE_OPTIONS,
  type LibraryFilters,
} from "@/lib/library/filters"
import { cn } from "@/lib/utils"

export type FilterOptions = {
  shotTypes: string[]
  moods: string[]
  lighting: string[]
  people: { id: string; name: string }[]
  projects: { id: string; name: string }[]
}

const COLOR_PRESETS = [
  "c0392b", "e67e22", "f1c40f", "27ae60", "16a085", "2980b9",
  "8e44ad", "e84393", "6d4c41", "f5f0e6", "7f8c8d", "111111",
]

const ANY = "__any__"

export function LibraryToolbar({ filters, options, total }: { filters: LibraryFilters; options: FilterOptions; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(filters.q ?? "")
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function apply(patch: Partial<LibraryFilters>) {
    const params = filtersToParams({ ...filters, ...patch })
    const qs = params.toString()
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

  const toggle = (key: "plano" | "clima" | "luz" | "fonte", value: string) => {
    const current = filters[key] as string[]
    apply({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] } as Partial<LibraryFilters>)
  }

  const activeCount = countActiveFilters(filters)
  const personName = options.people.find((p) => p.id === filters.pessoa)?.name
  const projectName = options.projects.find((p) => p.id === filters.projeto)?.name

  const chips: { label: string; clear: () => void }[] = [
    ...filters.plano.map((v) => ({ label: v, clear: () => toggle("plano", v) })),
    ...filters.clima.map((v) => ({ label: v, clear: () => toggle("clima", v) })),
    ...filters.luz.map((v) => ({ label: v, clear: () => toggle("luz", v) })),
    ...filters.fonte.map((v) => ({ label: SOURCE_OPTIONS[v], clear: () => toggle("fonte", v) })),
    ...(filters.formato ? [{ label: ASPECT_BUCKETS[filters.formato].label, clear: () => apply({ formato: undefined }) }] : []),
    ...(filters.tipo ? [{ label: filters.tipo === "image" ? "Imagens" : "Vídeos", clear: () => apply({ tipo: undefined }) }] : []),
    ...(filters.desde ? [{ label: SINCE_OPTIONS[filters.desde].label, clear: () => apply({ desde: undefined }) }] : []),
    ...(filters.nota ? [{ label: `${filters.nota}★ ou mais`, clear: () => apply({ nota: undefined }) }] : []),
    ...(filters.pessoa ? [{ label: personName ?? "Artista", clear: () => apply({ pessoa: undefined }) }] : []),
    ...(filters.projeto ? [{ label: projectName ?? "Projeto", clear: () => apply({ projeto: undefined }) }] : []),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-md flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar em descrições, tags e notas"
            aria-label="Buscar"
            className="h-11 bg-card pl-10"
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontalIcon /> Filtros
              {activeCount + (filters.cor ? 1 : 0) > 0 ? (
                <Badge className="ml-0.5 h-4 min-w-4 px-1 tabular-nums">{activeCount + (filters.cor ? 1 : 0)}</Badge>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>Combine quantos quiser. Dentro de um grupo, vale qualquer um dos marcados.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4 pb-8">
              <Group label="Tipo">
                <ChoiceChips
                  options={[
                    ["image", "Imagens"],
                    ["video", "Vídeos"],
                  ]}
                  value={filters.tipo ? [filters.tipo] : []}
                  onToggle={(v) => apply({ tipo: filters.tipo === v ? undefined : (v as "image" | "video") })}
                />
              </Group>
              <Group label="Cor">
                <ColorFilter value={filters.cor} onChange={(cor) => apply({ cor })} />
              </Group>
              <Group label="Plano">
                <ChoiceChips options={options.shotTypes.map((t) => [t, t])} value={filters.plano} onToggle={(v) => toggle("plano", v)} />
              </Group>
              <Group label="Clima">
                <ChoiceChips options={options.moods.map((t) => [t, t])} value={filters.clima} onToggle={(v) => toggle("clima", v)} />
              </Group>
              <Group label="Luz">
                <ChoiceChips options={options.lighting.map((t) => [t, t])} value={filters.luz} onToggle={(v) => toggle("luz", v)} />
              </Group>
              <Group label="Proporção">
                <ChoiceChips
                  options={Object.entries(ASPECT_BUCKETS).map(([k, v]) => [k, v.label])}
                  value={filters.formato ? [filters.formato] : []}
                  onToggle={(v) =>
                    apply({ formato: filters.formato === v ? undefined : (v as keyof typeof ASPECT_BUCKETS) })
                  }
                />
              </Group>
              <Group label="Fonte">
                <ChoiceChips options={Object.entries(SOURCE_OPTIONS)} value={filters.fonte} onToggle={(v) => toggle("fonte", v)} />
              </Group>
              <Group label="Adicionada">
                <ChoiceChips
                  options={Object.entries(SINCE_OPTIONS).map(([k, v]) => [k, v.label])}
                  value={filters.desde ? [filters.desde] : []}
                  onToggle={(v) => apply({ desde: filters.desde === v ? undefined : (v as keyof typeof SINCE_OPTIONS) })}
                />
              </Group>
              <Group label="Nota mínima">
                <ChoiceChips
                  options={[1, 2, 3, 4, 5].map((n) => [String(n), `${n}★`])}
                  value={filters.nota ? [String(filters.nota)] : []}
                  onToggle={(v) => apply({ nota: filters.nota === Number(v) ? undefined : Number(v) })}
                />
              </Group>
              {options.people.length > 0 ? (
                <Group label="Artista">
                  <EntitySelect
                    items={options.people}
                    value={filters.pessoa}
                    placeholder="Qualquer artista"
                    onChange={(pessoa) => apply({ pessoa })}
                  />
                </Group>
              ) : null}
              {options.projects.length > 0 ? (
                <Group label="Projeto">
                  <EntitySelect
                    items={options.projects}
                    value={filters.projeto}
                    placeholder="Qualquer projeto"
                    onChange={(projeto) => apply({ projeto })}
                  />
                </Group>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>

        <p className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {pending ? <Loader2Icon className="size-3 animate-spin" aria-hidden /> : null}
          {total} {total === 1 ? "referência" : "referências"}
        </p>
      </div>

      {chips.length > 0 || filters.cor ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.cor ? (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              <span className="size-3 rounded-full border" style={{ backgroundColor: `#${filters.cor}` }} aria-hidden />
              Cor #{filters.cor}
              <ChipClear label={`cor #${filters.cor}`} onClick={() => apply({ cor: undefined })} />
            </Badge>
          ) : null}
          {chips.map((c) => (
            <Badge key={c.label} variant="secondary" className="gap-1 pr-1">
              {c.label}
              <ChipClear label={c.label} onClick={c.clear} />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              apply({
                plano: [], clima: [], luz: [], fonte: [], formato: undefined, tipo: undefined,
                desde: undefined, nota: undefined, pessoa: undefined, projeto: undefined, cor: undefined,
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

function ChipClear({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={`Remover filtro ${label}`} onClick={onClick} className="rounded-full p-0.5 hover:bg-background/50">
      <XIcon className="size-3" />
    </button>
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

function ChoiceChips({
  options,
  value,
  onToggle,
}: {
  options: [string, string][]
  value: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([key, label]) => {
        const on = value.includes(key)
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(key)}
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

function EntitySelect({
  items,
  value,
  placeholder,
  onChange,
}: {
  items: { id: string; name: string }[]
  value?: string
  placeholder: string
  onChange: (id: string | undefined) => void
}) {
  return (
    <Select value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? undefined : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{placeholder}</SelectItem>
        {items.map((i) => (
          <SelectItem key={i.id} value={i.id}>
            {i.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Inside the Filtros sheet: presets, a custom picker and "clear". Matches palette colours. */
function ColorFilter({ value, onChange }: { value?: string; onChange: (hex: string | undefined) => void }) {
  const [draft, setDraft] = useState(value ? `#${value}` : "#b4c7cc")

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Mostra as referências com uma cor da paleta parecida.</p>
      <div className="grid grid-cols-6 gap-1.5">
        {COLOR_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={`#${hex}`}
            aria-pressed={value === hex}
            onClick={() => onChange(value === hex ? undefined : hex)}
            className={cn(
              "aspect-square rounded-sm border border-border-strong",
              value === hex && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
            )}
            style={{ backgroundColor: `#${hex}` }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Escolher outra cor"
          className="h-9 w-11 cursor-pointer rounded-sm border border-border-strong bg-transparent"
        />
        <span className="font-mono text-xs">{draft}</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => onChange(draft.slice(1).toLowerCase())}>
          Aplicar
        </Button>
        {value ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
            Limpar
          </Button>
        ) : null}
      </div>
    </div>
  )
}
