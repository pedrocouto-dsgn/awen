"use client"

import { PlusIcon, SparklesIcon } from "lucide-react"
import { useId } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PaletteSwatches, TechDetails } from "@/features/media/tech-details"
import type { ReferenceView } from "@/lib/references/view"
import type { VocabMap } from "@/lib/references/vocab"
import type { VocabCategory } from "@/types/database"

import { RatingInput, TagInput, VocabChips, VocabSelect } from "./fields"

export type ReviewDraft = Pick<
  ReferenceView,
  | "title"
  | "shot_type"
  | "camera_angle"
  | "camera_movement"
  | "lighting"
  | "mood"
  | "visual_style"
  | "texture_grain"
  | "setting"
  | "era"
  | "subject"
  | "description"
  | "tags"
  | "rating"
  | "notes"
>

export function draftFrom(r: ReferenceView): ReviewDraft {
  return {
    title: r.title,
    shot_type: r.shot_type,
    camera_angle: r.camera_angle,
    camera_movement: r.camera_movement,
    lighting: r.lighting,
    mood: r.mood,
    visual_style: r.visual_style,
    texture_grain: r.texture_grain,
    setting: r.setting,
    era: r.era,
    subject: r.subject,
    description: r.description,
    tags: r.tags,
    rating: r.rating,
    notes: r.notes,
  }
}

const CATEGORY_LABEL: Record<VocabCategory, string> = {
  shot_type: "Plano",
  camera_angle: "Ângulo",
  camera_movement: "Movimento",
  lighting: "Luz",
  mood: "Clima",
}

type Props = {
  reference: ReferenceView
  vocab: VocabMap
  editing: boolean
  draft: ReviewDraft
  onDraftChange: (patch: Partial<ReviewDraft>) => void
  onAcceptSuggestion: (category: VocabCategory, term: string) => void
}

export function ReviewPanel({ reference: r, vocab, editing, draft, onDraftChange, onAcceptSuggestion }: Props) {
  const uid = useId()
  const isVideo = r.type === "video"
  const suggestions = Object.entries(r.ai?.suggestedTerms ?? {}).flatMap(([category, terms]) =>
    (terms ?? [])
      .filter((t) => {
        const list = vocab[category as VocabCategory] ?? []
        return !list.some((v) => v.term.toLowerCase() === t.toLowerCase() && !v.archived)
      })
      .filter(() => category !== "camera_movement" || isVideo)
      .map((term) => ({ category: category as VocabCategory, term })),
  )

  const single = (field: "shot_type" | "camera_angle" | "camera_movement") =>
    editing ? (
      <VocabSelect
        id={`${uid}-${field}`}
        terms={vocab[field]}
        value={draft[field]}
        onChange={(v) => onDraftChange({ [field]: v })}
      />
    ) : (
      <Value>{draft[field]}</Value>
    )

  const multi = (field: "lighting" | "mood") =>
    editing ? (
      <VocabChips
        label={CATEGORY_LABEL[field]}
        terms={vocab[field]}
        value={draft[field]}
        onChange={(v) => onDraftChange({ [field]: v })}
      />
    ) : (
      <Chips values={draft[field]} />
    )

  const text = (field: "visual_style" | "texture_grain" | "setting" | "era" | "subject") =>
    editing ? (
      <Input
        id={`${uid}-${field}`}
        value={draft[field] ?? ""}
        onChange={(e) => onDraftChange({ [field]: e.target.value })}
      />
    ) : (
      <Value>{draft[field]}</Value>
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        {editing ? (
          <>
            <label htmlFor={`${uid}-title`} className="type-label text-muted-foreground">
              Título
            </label>
            <Input
              id={`${uid}-title`}
              value={draft.title ?? ""}
              onChange={(e) => onDraftChange({ title: e.target.value })}
            />
          </>
        ) : (
          <h2 className="type-title-md break-words">{draft.title ?? "Sem título"}</h2>
        )}
        {!r.analyzed_at && r.media.kind === "none" ? (
          <p className="text-xs text-muted-foreground">Sem análise de IA: este link não tem mídia. Preencha à mão.</p>
        ) : r.ai?.model ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <SparklesIcon className="size-3" aria-hidden />
            {r.status === "approved"
              ? `Análise inicial por IA (${r.ai.model}).`
              : `Sugerido por IA (${r.ai.model}). Revise antes de aprovar.`}
          </p>
        ) : null}
      </div>

      <Field label="Descrição" htmlFor={`${uid}-description`}>
        {editing ? (
          <Textarea
            id={`${uid}-description`}
            rows={4}
            value={draft.description ?? ""}
            onChange={(e) => onDraftChange({ description: e.target.value })}
          />
        ) : (
          <p className="text-sm leading-relaxed">{draft.description ?? <Empty />}</p>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label={CATEGORY_LABEL.shot_type} htmlFor={`${uid}-shot_type`}>
          {single("shot_type")}
        </Field>
        <Field label={CATEGORY_LABEL.camera_angle} htmlFor={`${uid}-camera_angle`}>
          {single("camera_angle")}
        </Field>
        {isVideo ? (
          <Field label={CATEGORY_LABEL.camera_movement} htmlFor={`${uid}-camera_movement`}>
            {single("camera_movement")}
          </Field>
        ) : null}
      </div>

      <Field label={CATEGORY_LABEL.lighting}>{multi("lighting")}</Field>
      <Field label={CATEGORY_LABEL.mood}>{multi("mood")}</Field>

      {suggestions.length > 0 ? (
        <div className="flex flex-col gap-2 border border-dashed border-border-strong p-4">
          <p className="text-xs text-muted-foreground">A IA sugeriu termos que não estão no seu vocabulário:</p>
          <ul className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <li key={`${s.category}:${s.term}`} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="text-muted-foreground">{CATEGORY_LABEL[s.category]}:</span> {s.term}
                </span>
                <Button variant="outline" size="xs" onClick={() => onAcceptSuggestion(s.category, s.term)}>
                  <PlusIcon /> Adicionar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label="Estilo visual" htmlFor={`${uid}-visual_style`}>
          {text("visual_style")}
        </Field>
        <Field label="Textura / grão" htmlFor={`${uid}-texture_grain`}>
          {text("texture_grain")}
        </Field>
        <Field label="Cenário" htmlFor={`${uid}-setting`}>
          {text("setting")}
        </Field>
        <Field label="Época" htmlFor={`${uid}-era`}>
          {text("era")}
        </Field>
      </div>
      <Field label="Assunto" htmlFor={`${uid}-subject`}>
        {text("subject")}
      </Field>

      <Field label="Tags" htmlFor={`${uid}-tags`}>
        {editing ? (
          <TagInput id={`${uid}-tags`} value={draft.tags} onChange={(tags) => onDraftChange({ tags })} />
        ) : (
          <Chips values={draft.tags} />
        )}
      </Field>

      <Field label="Nota">
        <RatingInput value={draft.rating} onChange={(rating) => onDraftChange({ rating })} />
      </Field>

      <Field label="Notas" htmlFor={`${uid}-notes`}>
        {editing ? (
          <Textarea
            id={`${uid}-notes`}
            rows={3}
            value={draft.notes ?? ""}
            placeholder="Anotações pessoais (entram na busca)"
            onChange={(e) => onDraftChange({ notes: e.target.value })}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{draft.notes ?? <Empty />}</p>
        )}
      </Field>

      <div className="h-px bg-gradient-hairline" aria-hidden />
      <PaletteSwatches palette={r.palette} />
      <TechDetails reference={r} />
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="type-label text-muted-foreground">
          {label}
        </label>
      ) : (
        <span className="type-label text-muted-foreground">{label}</span>
      )}
      {children}
    </div>
  )
}

function Empty() {
  return <span className="text-muted-foreground">—</span>
}

function Value({ children }: { children: React.ReactNode }) {
  return <p className="text-sm">{children ?? <Empty />}</p>
}

function Chips({ values }: { values: string[] }) {
  if (values.length === 0) return <Empty />
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <Badge key={v} variant="secondary">
          {v}
        </Badge>
      ))}
    </div>
  )
}
