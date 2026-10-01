// Object key layout: {ownerId}/{referenceId}/{file}, plus {ownerId}/profile/,
// {ownerId}/people/{personId}/ and {ownerId}/prompts/{promptId}/. Keys are never exposed as public URLs.

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
  /** Profile picture; the timestamp busts caches when it is replaced. */
  avatar: (ownerId: string) => `${ownerId}/profile/avatar-${Date.now()}.webp`,
  personPhoto: (ownerId: string, personId: string) => `${ownerId}/people/${personId}/photo-${Date.now()}.webp`,
  /** Results and inputs of a prompt entry (not references). */
  promptPrefix: (ownerId: string, promptId: string) => `${ownerId}/prompts/${promptId}/`,
  promptAsset: (ownerId: string, promptId: string, assetId: string, mime: string) =>
    `${ownerId}/prompts/${promptId}/${assetId}.${extensionFor(mime)}`,
  promptAssetThumb: (ownerId: string, promptId: string, assetId: string) =>
    `${ownerId}/prompts/${promptId}/${assetId}-thumb.jpg`,
}

/** True when the key belongs to this owner (defense in depth for presign requests). */
export function ownsKey(ownerId: string, key: string): boolean {
  return key.startsWith(`${ownerId}/`) && !key.includes("..")
}
