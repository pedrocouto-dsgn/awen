// Color math: sRGB <-> CIE Lab (D65) and CIE76 distance. Pure, isomorphic.

export type Lab = [l: number, a: number, b: number]
export type Rgb = [r: number, g: number, b: number]

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, c)) * 255)
}

const XN = 0.95047
const YN = 1.0
const ZN = 1.08883
const EPS = 216 / 24389
const KAPPA = 24389 / 27

function f(t: number): number {
  return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116
}

function fInv(t: number): number {
  const t3 = t * t * t
  return t3 > EPS ? t3 : (116 * t - 16) / KAPPA
}

export function rgbToLab([r, g, b]: Rgb): Lab {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / XN
  const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) / YN
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / ZN
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function labToRgb([l, a, b]: Lab): Rgb {
  const fy = (l + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const x = fInv(fx) * XN
  const y = (l > KAPPA * EPS ? fy ** 3 : l / KAPPA) * YN
  const z = fInv(fz) * ZN
  const lr = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
  const lg = x * -0.969266 + y * 1.8760108 + z * 0.041556
  const lb = x * 0.0556434 + y * -0.2040259 + z * 1.0572252
  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)]
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m?.[1]) return null
  const n = Number.parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function hexToLab(hex: string): Lab | null {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToLab(rgb) : null
}

/** CIE76 ΔE: Euclidean distance in Lab. ~2.3 is a just-noticeable difference. */
export function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
