"use client"

import { StarIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { VocabTerm } from "@/lib/references/vocab"
import { cn } from "@/lib/utils"

const NONE = "__none__"

/** Active terms, plus the current value if it is archived (so it stays visible). */
function visibleTerms(terms: VocabTerm[], current: string[]) {
  return terms.filter((t) => !t.archived || current.includes(t.term))
}

export function VocabSelect({
  id,
  terms,
  value,
  onChange,
}: {
  id?: string
  terms: VocabTerm[]
  value: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>—</SelectItem>
        {visibleTerms(terms, value ? [value] : []).map((t) => (
          <SelectItem key={t.id} value={t.term}>
            {t.term}
            {t.archived ? " (arquivado)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function VocabChips({
  terms,
  value,
  onChange,
  label,
}: {
  terms: VocabTerm[]
  value: string[]
  onChange: (value: string[]) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {visibleTerms(terms, value).map((t) => {
        const on = value.includes(t.term)
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== t.term) : [...value, t.term])}
            className={cn(
              "type-label border px-3 py-1.5 transition-colors",
              on
                ? "border-transparent bg-gradient-steel text-foreground"
                : "border-border-strong text-muted-foreground hover:text-foreground",
            )}
          >
            {t.term}
          </button>
        )
      })}
    </div>
  )
}

export function TagInput({ id, value, onChange }: { id?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("")

  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 0 && p.length <= 40)
    if (parts.length) onChange([...new Set([...value, ...parts])].slice(0, 30))
    setDraft("")
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                aria-label={`Remover ${tag}`}
                className="rounded-full p-0.5 hover:bg-background/50"
                onClick={() => onChange(value.filter((t) => t !== tag))}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Input
        id={id}
        value={draft}
        placeholder="Adicionar tag e Enter"
        onChange={(e) => {
          const v = e.target.value
          if (v.includes(",")) commit(v)
          else setDraft(v)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit(draft)
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => draft && commit(draft)}
      />
    </div>
  )
}

export function RatingInput({
  value,
  onChange,
  readOnly,
}: {
  value: number | null
  onChange?: (v: number | null) => void
  readOnly?: boolean
}) {
  return (
    <div role={readOnly ? "img" : "radiogroup"} aria-label={`Nota: ${value ?? "sem nota"}`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value !== null && n <= value
        const star = <StarIcon className={cn("size-4", on ? "fill-current text-foreground" : "text-muted-foreground")} />
        return readOnly ? (
          <span key={n}>{star}</span>
        ) : (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
            className="p-0.5"
            onClick={() => onChange?.(value === n ? null : n)}
          >
            {star}
          </button>
        )
      })}
    </div>
  )
}
