// Object key layout: {ownerId}/{referenceId}/{file}. Keys are never exposed as public URLs.

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

export function extensionFor(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin"
}

export const keys = {
  prefix: (ownerId: string, referenceId: string) => `${ownerId}/${referenceId}/`,
  original: (ownerId: string, referenceId: string, mime: string) =>
    `${ownerId}/${referenceId}/original.${extensionFor(mime)}`,
  thumb: (ownerId: string, referenceId: string) => `${ownerId}/${referenceId}/thumb.jpg`,
  frame: (ownerId: string, referenceId: string, index: number) => `${ownerId}/${referenceId}/frames/${index}.jpg`,
}

/** True when the key belongs to this owner (defense in depth for presign requests). */
export function ownsKey(ownerId: string, key: string): boolean {
  return key.startsWith(`${ownerId}/`) && !key.includes("..")
}
