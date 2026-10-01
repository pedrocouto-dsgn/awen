"use client"

import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import type { RunResponse } from "@/app/api/analysis/run/route"
import type { PauseReason } from "@/lib/analysis/process"
import type { QueueStats } from "@/lib/analysis/stats"

/** Spacing between analyses, to stay under the free-tier requests-per-minute limit. */
const MIN_INTERVAL_MS = 4_000
const IDLE_POLL_MS = 120_000
const ERROR_BACKOFF_MS = 30_000
const MAX_PAUSE_MS = 10 * 60_000

export type Pause = { reason: PauseReason; until: number; message: string }

type AnalysisContextValue = {
  stats: QueueStats
  pause: Pause | null
  /** Wake the worker (e.g. after new items were added), in whichever tab runs it. */
  kick: () => void
  /** Re-read the counters (e.g. after approving or rejecting). */
  refreshStats: () => Promise<void>
  retryFailed: (ids?: string[]) => Promise<number>
}

type ChannelMessage =
  | { type: "state"; stats: QueueStats; pause: Pause | null }
  | { type: "kick" }
  | { type: "hello" }

const CHANNEL = "awen-analysis"

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function AnalysisProvider({ initialStats, children }: { initialStats: QueueStats; children: React.ReactNode }) {
  const router = useRouter()
  const [stats, setStats] = useState(initialStats)
  const [pause, setPause] = useState<Pause | null>(null)
  const wake = useRef<(() => void) | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)
  const isWorker = useRef(false)
  const latest = useRef<{ stats: QueueStats; pause: Pause | null }>({ stats: initialStats, pause: null })

  // Only one tab runs the worker (Web Locks); it broadcasts its state to the other tabs.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel(CHANNEL)
    channel.current = ch
    ch.onmessage = (e: MessageEvent<ChannelMessage>) => {
      if (e.data.type === "state") {
        setStats(e.data.stats)
        setPause(e.data.pause)
      } else if (e.data.type === "kick") {
        wake.current?.()
      } else if (e.data.type === "hello" && isWorker.current) {
        ch.postMessage({ type: "state", ...latest.current } satisfies ChannelMessage)
      }
    }
    // A newly opened tab asks the worker tab for the current state.
    ch.postMessage({ type: "hello" } satisfies ChannelMessage)
    return () => {
      ch.close()
      channel.current = null
    }
  }, [])

  const publish = useCallback((next: QueueStats, nextPause: Pause | null) => {
    latest.current = { stats: next, pause: nextPause }
    setStats(next)
    setPause(nextPause)
    channel.current?.postMessage({ type: "state", stats: next, pause: nextPause } satisfies ChannelMessage)
  }, [])

  const kick = useCallback(() => {
    wake.current?.()
    channel.current?.postMessage({ type: "kick" } satisfies ChannelMessage)
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis/stats", { cache: "no-store" })
      if (!res.ok) return
      const next = (await res.json()) as QueueStats
      setStats(next)
      channel.current?.postMessage({ type: "state", stats: next, pause: null } satisfies ChannelMessage)
    } catch {
      // Counters will catch up on the next worker cycle.
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(done, ms)
        function done() {
          clearTimeout(timer)
          wake.current = null
          resolve()
        }
        wake.current = done
        signal.addEventListener("abort", done, { once: true })
      })

    async function loop() {
      while (!signal.aborted) {
        let response: RunResponse
        try {
          const res = await fetch("/api/analysis/run", { method: "POST", signal })
          if (res.status === 401) return
          if (!res.ok) throw new Error(String(res.status))
          response = (await res.json()) as RunResponse
        } catch {
          if (signal.aborted) return
          await sleep(ERROR_BACKOFF_MS)
          continue
        }

        const { result, stats: next } = response

        if (result.state === "paused") {
          const wait = Math.min(result.retryAfterMs, MAX_PAUSE_MS)
          publish(next, { reason: result.reason, until: Date.now() + wait, message: result.error })
          await sleep(wait)
          continue
        }
        publish(next, null)

        if (result.state === "idle") {
          const dueIn = next.nextDue ? new Date(next.nextDue).getTime() - Date.now() : Infinity
          await sleep(Math.max(1_000, Math.min(dueIn, IDLE_POLL_MS)))
          continue
        }

        // Embeddings change nothing on screen; only analyses need a refresh.
        if (result.state !== "embedded") router.refresh()
        await sleep(MIN_INTERVAL_MS)
      }
    }

    // One worker per browser: other tabs wait for the lock instead of doubling requests.
    if ("locks" in navigator) {
      void navigator.locks
        .request("awen-analysis-worker", { signal }, async () => {
          isWorker.current = true
          try {
            await loop()
          } finally {
            isWorker.current = false
          }
        })
        .catch(() => undefined)
    } else {
      isWorker.current = true
      void loop()
    }
    return () => controller.abort()
  }, [publish, router])

  const retryFailed = useCallback(
    async (ids?: string[]) => {
      const res = await fetch("/api/analysis/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { allFailed: true }),
      })
      if (!res.ok) throw new Error("Não foi possível reenviar para análise.")
      const data = (await res.json()) as { requeued: number; stats: QueueStats }
      publish(data.stats, null)
      kick()
      router.refresh()
      return data.requeued
    },
    [kick, publish, router],
  )

  const value = useMemo(
    () => ({ stats, pause, kick, refreshStats, retryFailed }),
    [stats, pause, kick, refreshStats, retryFailed],
  )
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error("useAnalysis must be used inside <AnalysisProvider>")
  return ctx
}

export function useOptionalAnalysis(): AnalysisContextValue | null {
  return useContext(AnalysisContext)
}
