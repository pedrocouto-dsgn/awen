// 64-bit perceptual hash (DCT pHash). Pure, isomorphic.
// Input must be a 32x32 image (the caller resizes: canvas in the browser, sharp on the server).

export const PHASH_SIZE = 32
const LOW = 8

const cosTable: Float64Array = (() => {
  const t = new Float64Array(PHASH_SIZE * PHASH_SIZE)
  for (let u = 0; u < PHASH_SIZE; u++) {
    for (let x = 0; x < PHASH_SIZE; x++) {
      t[u * PHASH_SIZE + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * PHASH_SIZE))
    }
  }
  return t
})()

/** @param rgba 32*32*4 bytes */
export function phashFromRgba32(rgba: Uint8Array | Uint8ClampedArray): string {
  if (rgba.length < PHASH_SIZE * PHASH_SIZE * 4) throw new Error("phash expects a 32x32 RGBA image")
  const n = PHASH_SIZE
  const gray = new Float64Array(n * n)
  for (let i = 0; i < n * n; i++) {
    const o = i * 4
    gray[i] = 0.299 * (rgba[o] ?? 0) + 0.587 * (rgba[o + 1] ?? 0) + 0.114 * (rgba[o + 2] ?? 0)
  }

  // 2D DCT, only the 8x8 low-frequency block is needed.
  const coeffs: number[] = []
  for (let u = 0; u < LOW; u++) {
    for (let v = 0; v < LOW; v++) {
      let sum = 0
      for (let y = 0; y < n; y++) {
        const cv = cosTable[v * n + y]!
        for (let x = 0; x < n; x++) {
          sum += gray[y * n + x]! * cosTable[u * n + x]! * cv
        }
      }
      coeffs.push(sum)
    }
  }

  // Median without the DC term.
  const ac = coeffs.slice(1).sort((a, b) => a - b)
  const median = ((ac[31] ?? 0) + (ac[32] ?? 0)) / 2

  let hex = ""
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0
    for (let b = 0; b < 4; b++) nibble = (nibble << 1) | ((coeffs[i + b] ?? 0) > median ? 1 : 0)
    hex += nibble.toString(16)
  }
  return hex
}

export function hammingDistance(a: string, b: string): number {
  let d = 0
  for (let i = 0; i < 16; i++) {
    let x = Number.parseInt(a[i] ?? "0", 16) ^ Number.parseInt(b[i] ?? "0", 16)
    while (x) {
      d += x & 1
      x >>= 1
    }
  }
  return d
}
