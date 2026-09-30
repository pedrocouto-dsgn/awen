import { ExternalLinkIcon } from "lucide-react"

import type { ReferenceView } from "@/lib/references/view"

const SOURCE_LABEL: Record<ReferenceView["source_kind"], string> = {
  upload: "Upload",
  youtube: "YouTube",
  vimeo: "Vimeo",
  link: "Link",
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${String(sec).padStart(2, "0")}`
}

/** Common cinema/photo ratios for a human-friendly label. */
export function aspectLabel(ratio: number | null) {
  if (!ratio) return null
  const known: [number, string][] = [
    [9 / 16, "9:16"],
    [2 / 3, "2:3"],
    [4 / 5, "4:5"],
    [3 / 4, "3:4"],
    [1, "1:1"],
    [5 / 4, "5:4"],
    [4 / 3, "4:3"],
    [3 / 2, "3:2"],
    [16 / 9, "16:9"],
    [1.85, "1.85:1"],
    [2, "2:1"],
    [2.39, "2.39:1"],
  ]
  const hit = known.find(([r]) => Math.abs(r - ratio) / r < 0.02)
  return hit ? hit[1] : `${ratio.toFixed(2)}:1`
}

/** palette-swatch: a row of 5-6 swatches, 48px high, with hex and percentage. */
export function PaletteSwatches({ palette, size = "md" }: { palette: ReferenceView["palette"]; size?: "sm" | "md" }) {
  if (palette.length === 0) return null
  if (size === "sm") {
    return (
      <div className="flex h-1 w-full overflow-hidden" aria-hidden>
        {palette.map((c) => (
          <div key={c.hex} style={{ backgroundColor: c.hex, width: `${c.pct}%` }} />
        ))}
      </div>
    )
  }
  return (
    <ul className="grid grid-cols-6 gap-1" aria-label="Paleta de cores">
      {palette.map((c) => (
        <li key={c.hex} className="flex min-w-0 flex-col gap-1.5">
          <span className="h-12 w-full border border-border" style={{ backgroundColor: c.hex }} aria-hidden />
          <span className="truncate font-mono text-[10px] leading-tight text-muted-foreground">
            {c.hex}
            <br />
            <span className="tabular-nums">{Math.round(c.pct)}%</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function TechDetails({ reference }: { reference: ReferenceView }) {
  const r = reference
  const rows: [string, React.ReactNode][] = []
  rows.push(["Tipo", `${r.type === "video" ? "Vídeo" : "Imagem"} · ${SOURCE_LABEL[r.source_kind]}`])
  if (r.width && r.height) rows.push(["Dimensões", `${r.width} × ${r.height}`])
  const aspect = aspectLabel(r.aspect_ratio)
  if (aspect) rows.push(["Proporção", aspect])
  if (r.duration) rows.push(["Duração", formatDuration(r.duration)])
  if (r.fps) rows.push(["FPS", String(r.fps)])
  if (r.file_size) rows.push(["Arquivo", `${formatBytes(r.file_size)}${r.mime_type ? ` · ${r.mime_type}` : ""}`])
  if (r.sourceMeta.author) rows.push(["Canal / autor", r.sourceMeta.author])
  if (r.source_url) {
    let host = r.source_url
    try {
      host = new URL(r.source_url).hostname.replace(/^www\./, "")
    } catch {}
    rows.push([
      "Fonte",
      <a
        key="src"
        href={r.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-link underline-offset-4 hover:underline"
      >
        {host} <ExternalLinkIcon className="size-3" aria-hidden />
      </a>,
    ])
  }
  rows.push(["Adicionada", new Date(r.created_at).toLocaleDateString("pt-BR", { dateStyle: "medium" })])

  return (
    <dl className="type-caption grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 truncate">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
