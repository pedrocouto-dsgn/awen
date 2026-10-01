/**
 * Error that should be retried later (rate limit, overload, transient network).
 * `pauseQueue` means every item would fail the same way (quota, billing, bad key),
 * so the worker should stop for a while instead of burning through the queue.
 */
export class RetryableAnalysisError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
    readonly pauseQueue: false | "rate_limit" | "billing" | "auth" = false,
    /** The provider's daily quota is used up (not just a per-minute limit): a fallback provider may take over. */
    readonly dailyQuota = false,
  ) {
    super(message)
  }
}

/** Error that will not succeed on retry (bad input, blocked content, unsupported input). */
export class FatalAnalysisError extends Error {}

/** Maps an HTTP status from any AI provider to the queue's retry semantics. */
export function errorForStatus(
  provider: string,
  status: number,
  message: string,
  retryAfterMs?: number,
  dailyQuota = false,
): RetryableAnalysisError | FatalAnalysisError {
  if (status === 429) {
    return dailyQuota
      ? new RetryableAnalysisError(`${provider} daily quota reached.`, retryAfterMs ?? 60 * 60_000, "rate_limit", true)
      : new RetryableAnalysisError(`${provider} rate limit reached.`, retryAfterMs ?? 60_000, "rate_limit")
  }
  if (status === 402) {
    return new RetryableAnalysisError(
      `${provider} billing: credits depleted. Add credits or use a free-tier API key.`,
      60 * 60_000,
      "billing",
    )
  }
  if (status >= 500 || status === 408) {
    return new RetryableAnalysisError(`${provider} temporarily unavailable (${status}).`, retryAfterMs)
  }
  if (status === 401 || status === 403) {
    return new RetryableAnalysisError(`${provider} API key rejected. Check AI_API_KEY.`, 30 * 60_000, "auth")
  }
  return new FatalAnalysisError(`${provider} rejected the request (${status}): ${shorten(message)}`)
}

export function shorten(message: string): string {
  return message.replace(/\s+/g, " ").slice(0, 300)
}
