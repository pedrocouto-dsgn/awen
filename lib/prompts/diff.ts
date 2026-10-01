// Word-level diff between two prompt texts, for the side-by-side comparison. Pure.

export type DiffPart = { kind: "same" | "added" | "removed"; text: string }

/** Above this many LCS cells the diff falls back to whole lines (keeps long prompts fast). */
const MAX_CELLS = 4_000_000

/** Splits into words with their trailing whitespace, so joining the parts gives back the text. */
function tokenize(text: string, byLine: boolean): string[] {
  return byLine ? (text.match(/[^\n]*\n|[^\n]+$/g) ?? []) : (text.match(/\S+\s*|\s+/g) ?? [])
}

export function diffText(before: string, after: string): DiffPart[] {
  const a = tokenize(before, false)
  const b = tokenize(after, false)

  // Common prefix and suffix need no table.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  let midA = a.slice(start, endA)
  let midB = b.slice(start, endB)
  if (midA.length * midB.length > MAX_CELLS) {
    midA = tokenize(midA.join(""), true)
    midB = tokenize(midB.join(""), true)
  }
  const middle = midA.length * midB.length > MAX_CELLS ? replaceAll(midA, midB) : lcsDiff(midA, midB)

  return merge([
    { kind: "same", text: a.slice(0, start).join("") },
    ...middle,
    { kind: "same", text: a.slice(endA).join("") },
  ])
}

function replaceAll(a: string[], b: string[]): DiffPart[] {
  return [
    { kind: "removed", text: a.join("") },
    { kind: "added", text: b.join("") },
  ]
}

function lcsDiff(a: string[], b: string[]): DiffPart[] {
  const n = a.length
  const m = b.length
  // lengths[i][j] = LCS of a[i..] and b[j..], flattened.
  const lengths = new Uint32Array((n + 1) * (m + 1))
  const at = (i: number, j: number) => i * (m + 1) + j
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[at(i, j)] =
        a[i] === b[j] ? lengths[at(i + 1, j + 1)]! + 1 : Math.max(lengths[at(i + 1, j)]!, lengths[at(i, j + 1)]!)
    }
  }

  const parts: DiffPart[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      parts.push({ kind: "same", text: a[i]! })
      i++
      j++
    } else if (lengths[at(i + 1, j)]! >= lengths[at(i, j + 1)]!) {
      parts.push({ kind: "removed", text: a[i++]! })
    } else {
      parts.push({ kind: "added", text: b[j++]! })
    }
  }
  while (i < n) parts.push({ kind: "removed", text: a[i++]! })
  while (j < m) parts.push({ kind: "added", text: b[j++]! })
  return parts
}

/** Joins neighbours of the same kind and drops empty parts. */
function merge(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = []
  for (const p of parts) {
    if (!p.text) continue
    const last = out[out.length - 1]
    if (last && last.kind === p.kind) last.text += p.text
    else out.push({ ...p })
  }
  return out
}
