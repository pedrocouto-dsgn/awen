import "server-only"

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

// Fetch for user-supplied URLs: http(s) only, public IPs only (no SSRF into
// private networks or cloud metadata), manual redirects re-checked on every hop,
// timeout and size cap.

const MAX_REDIRECTS = 4
const USER_AGENT =
  "Mozilla/5.0 (compatible; AwenBot/1.0; +https://awen.vercel.app) AppleWebKit/537.36 (KHTML, like Gecko)"

export class UnsafeUrlError extends Error {}

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number)
  const [a = 0, b = 0] = p
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateIP(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip)
  const v6 = ip.toLowerCase()
  if (v6 === "::" || v6 === "::1") return true
  if (v6.startsWith("::ffff:")) return isPrivateIPv4(v6.slice(7))
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6)
}

export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  const url = new URL(raw)
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http(s) URLs")
  if (url.username || url.password) throw new UnsafeUrlError("Credentials in URL")
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Non-standard port")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("Private host")
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (addresses.length === 0 || addresses.some((a) => isPrivateIP(a.address))) {
    throw new UnsafeUrlError("Private address")
  }
  return url
}

type SafeFetchOptions = {
  timeoutMs?: number
  maxBytes?: number
  accept?: string
  /** Stop following redirects once the next hop matches; returns it with an empty body. */
  stopAt?: (url: URL) => boolean
}

export type SafeResponse = { url: URL; status: number; contentType: string; body: Uint8Array }

export async function safeFetch(raw: string, options: SafeFetchOptions = {}): Promise<SafeResponse> {
  const { timeoutMs = 8000, maxBytes = 3 * 1024 * 1024, accept = "*/*", stopAt } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = await assertPublicUrl(raw)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "en,pt-BR;q=0.8" },
      })
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location")
        await res.body?.cancel()
        if (!location) throw new Error("Redirect without location")
        url = await assertPublicUrl(new URL(location, url))
        if (stopAt?.(url)) return { url, status: res.status, contentType: "", body: new Uint8Array() }
        continue
      }
      const declared = Number(res.headers.get("content-length") ?? 0)
      if (declared > maxBytes) {
        await res.body?.cancel()
        throw new Error("Response too large")
      }
      const body = await readCapped(res, maxBytes)
      return { url, status: res.status, contentType: res.headers.get("content-type") ?? "", body }
    }
    throw new Error("Too many redirects")
  } finally {
    clearTimeout(timer)
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error("Response too large")
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}
