import type { PaletteColor } from "@/lib/palette"

export type ProbeResult = {
  type: "image" | "video"
  width: number
  height: number
  duration: number | null
  fps: number | null
  palette: PaletteColor[]
  phash: string | null
  thumb: Blob
  frames: Blob[]
}
