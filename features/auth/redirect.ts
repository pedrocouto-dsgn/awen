/** Only allow same-origin relative paths as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback = "/library"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  return next
}
