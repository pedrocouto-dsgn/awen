// Dominant color palette via k-means in Lab space. Pure and deterministic, so the
// browser (canvas pixels) and the server (sharp pixels) produce comparable results.

import { deltaE, labToRgb, rgbToHex, rgbToLab, type Lab } from "./color"

export type PaletteColor = { hex: string; pct: number; lab: Lab }

export type PixelSource = {
  /** RGBA, 4 bytes per pixel. */
  data: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}

type Options = { colors?: number; maxSamples?: number; iterations?: number }

/** Small seeded PRNG (mulberry32) so results are reproducible. */
function prng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function samplePixels({ data, width, height }: PixelSource, maxSamples: number): Lab[] {
  const total = width * height
  const step = Math.max(1, Math.floor(total / maxSamples))
  const out: Lab[] = []
  for (let i = 0; i < total; i += step) {
    const o = i * 4
    const alpha = data[o + 3] ?? 255
    if (alpha < 128) continue
    out.push(rgbToLab([data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0]))
  }
  return out
}

function nearest(p: Lab, centers: Lab[]): number {
  let best = 0
  let bestD = Infinity
  for (let c = 0; c < centers.length; c++) {
    const center = centers[c]!
    const d = (p[0] - center[0]) ** 2 + (p[1] - center[1]) ** 2 + (p[2] - center[2]) ** 2
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

/** k-means++ seeding. */
function seedCenters(points: Lab[], k: number, rand: () => number): Lab[] {
  const centers: Lab[] = [points[Math.floor(rand() * points.length)]!]
  const dist = new Float64Array(points.length)
  while (centers.length < k) {
    let sum = 0
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!
      const c = centers[nearest(p, centers)]!
      dist[i] = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
      sum += dist[i]!
    }
    if (sum === 0) break
    let target = rand() * sum
    let idx = 0
    for (; idx < points.length - 1; idx++) {
      target -= dist[idx]!
      if (target <= 0) break
    }
    centers.push(points[idx]!)
  }
  return centers
}

/**
 * Returns up to `colors` dominant colors (default 6), sorted by coverage.
 * `pct` is a percentage (0–100) of the sampled, non-transparent pixels.
 */
export function extractPalette(source: PixelSource, options: Options = {}): PaletteColor[] {
  const { colors = 6, maxSamples = 12000, iterations = 14 } = options
  const points = samplePixels(source, maxSamples)
  if (points.length === 0) return []

  const rand = prng(0xa3e1)
  // Over-cluster a little, then merge near-identical clusters.
  const k = Math.min(colors + 2, points.length)
  let centers = seedCenters(points, k, rand)
  const assign = new Int32Array(points.length)

  for (let iter = 0; iter < iterations; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0] as [number, number, number, number])
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!
      const c = nearest(p, centers)
      assign[i] = c
      const s = sums[c]!
      s[0] += p[0]
      s[1] += p[1]
      s[2] += p[2]
      s[3] += 1
    }
    centers = centers.map((c, i) => {
      const s = sums[i]!
      return s[3] > 0 ? ([s[0] / s[3], s[1] / s[3], s[2] / s[3]] as Lab) : c
    })
  }

  const counts = new Array<number>(centers.length).fill(0)
  for (let i = 0; i < points.length; i++) counts[assign[i]!]! += 1

  let clusters = centers
    .map((lab, i) => ({ lab, count: counts[i]! }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  // Merge clusters that are visually almost the same color.
  const merged: { lab: Lab; count: number }[] = []
  for (const c of clusters) {
    const target = merged.find((m) => deltaE(m.lab, c.lab) < 6)
    if (target) {
      const n = target.count + c.count
      target.lab = [
        (target.lab[0] * target.count + c.lab[0] * c.count) / n,
        (target.lab[1] * target.count + c.lab[1] * c.count) / n,
        (target.lab[2] * target.count + c.lab[2] * c.count) / n,
      ]
      target.count = n
    } else {
      merged.push({ lab: [...c.lab], count: c.count })
    }
  }
  clusters = merged.sort((a, b) => b.count - a.count).slice(0, colors)

  const total = points.length
  return clusters
    .map(({ lab, count }) => ({
      hex: rgbToHex(labToRgb(lab)),
      pct: Math.round((count / total) * 1000) / 10,
      lab: [round1(lab[0]), round1(lab[1]), round1(lab[2])] as Lab,
    }))
    .filter((c) => c.pct >= 1)
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export { deltaE, hexToLab, hexToRgb, rgbToHex, rgbToLab, type Lab } from "./color"
