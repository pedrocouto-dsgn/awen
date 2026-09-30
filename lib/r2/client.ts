import "server-only"

import { S3Client } from "@aws-sdk/client-s3"

import { serverEnv } from "@/lib/env/server"

let client: S3Client | undefined

export function r2(): S3Client {
  if (client) return client
  const env = serverEnv()
  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    // R2 does not support the newer default checksum headers on presigned PUTs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
  return client
}

export function bucket(): string {
  return serverEnv().R2_BUCKET
}
