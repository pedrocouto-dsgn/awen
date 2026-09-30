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
  /** Wake the worker (e.g. after new items were added). */
  kick: () => void
  retryFailed: (ids?: string[]) => Promise<number>
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function AnalysisProvider({ initialStats, children }: { initialStats: QueueStats; children: React.ReactNode }) {
  const router = useRouter()
  const [stats, setStats] = useState(initialStats)
  const [pause, setPause] = useState<Pause | null>(null)
  const wake = useRef<(() => void) | null>(null)

  const kick = useCallback(() => wake.current?.(), [])

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
        setStats(next)

        if (result.state === "paused") {
          const wait = Math.min(result.retryAfterMs, MAX_PAUSE_MS)
          setPause({ reason: result.reason, until: Date.now() + wait, message: result.error })
          await sleep(wait)
          setPause(null)
          continue
        }
        setPause(null)

        if (result.state === "idle") {
          const dueIn = next.nextDue ? new Date(next.nextDue).getTime() - Date.now() : Infinity
          await sleep(Math.max(1_000, Math.min(dueIn, IDLE_POLL_MS)))
          continue
        }

        router.refresh()
        await sleep(MIN_INTERVAL_MS)
      }
    }

    // One worker per browser: other tabs wait for the lock instead of doubling requests.
    if ("locks" in navigator) {
      void navigator.locks.request("awen-analysis-worker", { signal }, () => loop()).catch(() => undefined)
    } else {
      void loop()
    }
    return () => controller.abort()
  }, [router])

  const retryFailed = useCallback(
    async (ids?: string[]) => {
      const res = await fetch("/api/analysis/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { allFailed: true }),
      })
      if (!res.ok) throw new Error("Não foi possível reenviar para análise.")
      const data = (await res.json()) as { requeued: number; stats: QueueStats }
      setStats(data.stats)
      kick()
      router.refresh()
      return data.requeued
    },
    [kick, router],
  )

  const value = useMemo(() => ({ stats, pause, kick, retryFailed }), [stats, pause, kick, retryFailed])
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
