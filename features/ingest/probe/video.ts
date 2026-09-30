import { LIMITS } from "@/lib/media/limits"
import { extractPalette } from "@/lib/palette"
import { PHASH_SIZE, phashFromRgba32 } from "@/lib/phash"

import { drawPixels, fitInside, jpegThumb, makeCanvas } from "./canvas"
import { fpsFromMp4, fpsFromPlayback } from "./fps"
import type { ProbeResult } from "./types"

const FRAME_POSITIONS = [0.1, 0.35, 0.6, 0.85]
const CODEC_ERROR = "Não foi possível ler este vídeo no navegador. Converta para MP4 (H.264) e tente de novo."

/**
 * Waits for a media event. Browsers do not load media in hidden tabs, so the
 * timeout only counts time while the tab is visible: switching tabs pauses the
 * probe instead of failing it.
 */
function waitFor(video: HTMLVideoElement, event: "loadedmetadata" | "seeked" | "loadeddata", ms = 20000) {
  return new Promise<void>((resolve, reject) => {
    let visibleElapsed = 0
    const TICK = 250
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") visibleElapsed += TICK
      if (visibleElapsed >= ms) cleanup(new Error(CODEC_ERROR))
    }, TICK)
    const onEvent = () => cleanup()
    const onError = () => cleanup(new Error(CODEC_ERROR))
    function cleanup(error?: Error) {
      clearInterval(timer)
      video.removeEventListener(event, onEvent)
      video.removeEventListener("error", onError)
      if (error) reject(error)
      else resolve()
    }
    video.addEventListener(event, onEvent, { once: true })
    video.addEventListener("error", onError, { once: true })
  })
}

export async function probeVideo(file: File): Promise<ProbeResult> {
  const url = URL.createObjectURL(file)
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.src = url

  try {
    await waitFor(video, "loadedmetadata")
    const { videoWidth: width, videoHeight: height, duration } = video
    if (!width || !height || !Number.isFinite(duration) || duration <= 0) throw new Error(CODEC_ERROR)
    if (video.readyState < 2) await waitFor(video, "loadeddata")

    const [tw, th] = fitInside(width, height, 120)
    const strip = makeCanvas(tw * FRAME_POSITIONS.length, th)
    const jpegs: Blob[] = []
    let phash: string | null = null

    for (const [i, position] of FRAME_POSITIONS.entries()) {
      video.currentTime = Math.min(duration * position, Math.max(0, duration - 0.05))
      await waitFor(video, "seeked")
      jpegs.push(await jpegThumb(video, width, height, LIMITS.thumbMaxSide))
      strip.ctx.drawImage(video, i * tw, 0, tw, th)
      if (i === 0) phash = phashFromRgba32(drawPixels(video, PHASH_SIZE, PHASH_SIZE).data)
    }

    const pixels = strip.ctx.getImageData(0, 0, strip.canvas.width, strip.canvas.height)
    const fps =
      (file.type === "video/mp4" || file.type === "video/quicktime" ? await fpsFromMp4(file).catch(() => null) : null) ??
      (await fpsFromPlayback(video))

    const [thumb, ...frames] = jpegs
    return {
      type: "video",
      width,
      height,
      duration: Math.round(duration * 1000) / 1000,
      fps,
      palette: extractPalette({ data: pixels.data, width: pixels.width, height: pixels.height }),
      phash,
      thumb: thumb!,
      frames: frames.slice(0, LIMITS.maxFrames),
    }
  } finally {
    video.removeAttribute("src")
    video.load()
    URL.revokeObjectURL(url)
  }
}
