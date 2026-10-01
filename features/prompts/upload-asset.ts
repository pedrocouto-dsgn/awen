"use client"

import { probeImage } from "@/features/ingest/probe/image"
import { probeVideo } from "@/features/ingest/probe/video"
import { apiJson, putToR2 } from "@/features/ingest/upload"
import { LIMITS, mediaTypeForMime } from "@/lib/media/limits"
import type { PromptAssetCreateResponse } from "@/lib/validation/prompt"

export type AssetRole = "result" | "input"

/** Reads the file in the browser, uploads it and its preview to R2, then marks it ready. */
export async function uploadPromptAsset(
  promptId: string,
  role: AssetRole,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const type = mediaTypeForMime(file.type)
  if (!type) throw new Error("Formato não suportado. Use JPG, PNG, WebP, GIF, AVIF, MP4, MOV ou WebM.")
  const max = type === "image" ? LIMITS.imageBytes : LIMITS.videoBytes
  if (file.size > max) throw new Error(`Arquivo grande demais (máx. ${Math.round(max / 1024 / 1024)} MB).`)

  const probe = type === "image" ? await probeImage(file) : await probeVideo(file)
  const created = await apiJson<PromptAssetCreateResponse>(`/api/prompts/${promptId}/assets`, {
    method: "POST",
    body: JSON.stringify({
      source: "file",
      role,
      file: { type, mimeType: file.type, size: file.size },
      tech: { width: probe.width, height: probe.height, duration: probe.duration, palette: probe.palette },
      thumb: { size: probe.thumb.size },
    }),
  })
  const upload = created.upload!

  try {
    const total = file.size + probe.thumb.size
    let thumbLoaded = 0
    await putToR2(upload.thumb.url, probe.thumb, upload.thumb.contentType, (n) => {
      thumbLoaded = n
      onProgress?.(Math.round((n / total) * 100))
    })
    await putToR2(upload.original.url, file, upload.original.contentType, (n) =>
      onProgress?.(Math.min(99, Math.round(((thumbLoaded + n) / total) * 100))),
    )
    await apiJson(`/api/prompts/${promptId}/assets/${created.assetId}/finalize`, { method: "POST" })
  } catch (error) {
    await fetch(`/api/prompts/${promptId}/assets/${created.assetId}`, { method: "DELETE" }).catch(() => undefined)
    throw error
  }
  onProgress?.(100)
  return created.assetId
}

export async function addReferenceAsset(promptId: string, role: AssetRole, referenceId: string): Promise<string> {
  const created = await apiJson<PromptAssetCreateResponse>(`/api/prompts/${promptId}/assets`, {
    method: "POST",
    body: JSON.stringify({ source: "reference", role, referenceId }),
  })
  return created.assetId
}

export async function removeAsset(promptId: string, assetId: string): Promise<void> {
  await apiJson(`/api/prompts/${promptId}/assets/${assetId}`, { method: "DELETE" })
}
