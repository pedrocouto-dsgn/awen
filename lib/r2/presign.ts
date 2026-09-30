import "server-only"

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { bucket, r2 } from "./client"

const PUT_TTL_SECONDS = 15 * 60
const GET_TTL_SECONDS = 10 * 60

/**
 * Presigned PUT locked to an exact Content-Type and Content-Length, so the
 * browser cannot upload a different type or a bigger file than declared.
 */
export async function presignPut(key: string, contentType: string, contentLength: number): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  })
  return getSignedUrl(r2(), command, {
    expiresIn: PUT_TTL_SECONDS,
    signableHeaders: new Set(["content-type", "content-length"]),
  })
}

export async function presignGet(key: string, ttlSeconds = GET_TTL_SECONDS): Promise<string> {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: ttlSeconds })
}

/** Presigns many keys at once; missing keys map to null. */
export async function presignGetMany(keys: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(keys.filter((k): k is string => Boolean(k)))]
  const urls = await Promise.all(unique.map((k) => presignGet(k)))
  return new Map(unique.map((k, i) => [k, urls[i]!]))
}

export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const res = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return { size: res.ContentLength ?? 0, contentType: res.ContentType }
  } catch {
    return null
  }
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await r2().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, ContentLength: body.byteLength }),
  )
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
  if (!res.Body) throw new Error("Empty object body")
  return res.Body.transformToByteArray()
}

/** Deletes every object under a prefix (e.g. a reference's folder). */
export async function deletePrefix(prefix: string): Promise<void> {
  let token: string | undefined
  do {
    const list = await r2().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
    )
    const objects = (list.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []))
    if (objects.length > 0) {
      await r2().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: objects, Quiet: true } }))
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined
  } while (token)
}
