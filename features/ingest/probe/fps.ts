import { createFile, MP4BoxBuffer, type Movie } from "mp4box"

const COMMON_RATES = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 90, 100, 119.88, 120, 240]

/** Snaps to the nearest common frame rate when within 0.5%, otherwise rounds to 3 decimals. */
export function snapFps(fps: number): number {
  let best: number | null = null
  for (const rate of COMMON_RATES) {
    const error = Math.abs(rate - fps) / rate
    if (error < 0.005 && (best === null || error < Math.abs(best - fps) / best)) best = rate
  }
  return best ?? Math.round(fps * 1000) / 1000
}

type SttsBox = { sample_counts: number[]; sample_deltas: number[] }

/** Frame duration that covers the most samples (robust to a few odd frames). */
function dominantDelta(stts: SttsBox | undefined): number | null {
  if (!stts?.sample_deltas?.length) return null
  let bestIndex = 0
  for (let i = 1; i < stts.sample_deltas.length; i++) {
    if ((stts.sample_counts[i] ?? 0) > (stts.sample_counts[bestIndex] ?? 0)) bestIndex = i
  }
  return stts.sample_deltas[bestIndex] ?? null
}

/**
 * Reads the frame rate from MP4/MOV headers. mp4box asks for the byte ranges it
 * needs, so a moov atom at the end of the file does not require reading the mdat.
 */
export async function fpsFromMp4(file: File): Promise<number | null> {
  const mp4 = createFile()
  let movie: Movie | null = null
  let failed = false
  mp4.onReady = (info) => {
    movie = info
  }
  mp4.onError = () => {
    failed = true
  }

  const CHUNK = 1024 * 1024
  let position = 0
  for (let i = 0; i < 64 && !movie && !failed && position < file.size; i++) {
    const end = Math.min(file.size, position + CHUNK)
    const buffer = MP4BoxBuffer.fromArrayBuffer(await file.slice(position, end).arrayBuffer(), position)
    const next = mp4.appendBuffer(buffer, end >= file.size)
    position = next > position ? next : end
  }
  mp4.flush()

  const track = (movie as Movie | null)?.videoTracks[0]
  if (!track || !track.timescale) return null
  const trak = mp4.getTrackById(track.id) as { mdia?: { minf?: { stbl?: { stts?: SttsBox } } } } | undefined
  const delta = dominantDelta(trak?.mdia?.minf?.stbl?.stts)
  const fps = delta
    ? track.timescale / delta
    : track.nb_samples && track.duration
      ? (track.nb_samples * track.timescale) / track.duration
      : NaN
  return Number.isFinite(fps) && fps > 0 ? snapFps(fps) : null
}

/** Fallback: measure presented frames while playing muted for a moment. */
export async function fpsFromPlayback(video: HTMLVideoElement): Promise<number | null> {
  if (!("requestVideoFrameCallback" in video)) return null
  const times: number[] = []
  const done = new Promise<void>((resolve) => {
    const onFrame: VideoFrameRequestCallback = (_now, meta) => {
      times.push(meta.mediaTime)
      if (times.length >= 24) resolve()
      else video.requestVideoFrameCallback(onFrame)
    }
    video.requestVideoFrameCallback(onFrame)
    setTimeout(resolve, 2000)
  })
  try {
    video.currentTime = 0
    await video.play()
    await done
  } catch {
    return null
  } finally {
    video.pause()
  }
  if (times.length < 6) return null
  const deltas = times.slice(1).map((t, i) => t - times[i]!).filter((d) => d > 0)
  deltas.sort((a, b) => a - b)
  const median = deltas[Math.floor(deltas.length / 2)]
  return median ? snapFps(1 / median) : null
}
