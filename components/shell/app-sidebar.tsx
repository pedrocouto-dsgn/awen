"use client"

import { useCallback, useEffect, useState } from "react"

import type { NavData } from "@/lib/shell/nav-data"
import { cn } from "@/lib/utils"

import { SidebarContent } from "./sidebar-content"
import { SIDEBAR_COOKIE } from "./sidebar-state"

/**
 * Floating glass sidebar (tablet and up), Pinterest-style: a rail of icons with
 * tooltips when collapsed, icons plus labels when expanded. Toggle with the button
 * or "[". The choice is kept in a cookie so SSR renders the right width.
 */
export function AppSidebar({ data, defaultExpanded }: { data: NavData; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "expanded" : "collapsed"}; path=/; max-age=31536000; samesite=lax`
      return next
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])

  return (
    <aside
      aria-label="Navegação"
      data-expanded={expanded}
      className={cn(
        "sticky top-0 z-30 hidden h-svh shrink-0 py-3 pl-3 transition-[width] duration-200 ease-out md:block",
        expanded ? "w-70" : "w-20",
      )}
    >
      <div className="glass h-full overflow-hidden rounded-2xl">
        <SidebarContent data={data} expanded={expanded} onToggle={toggle} />
      </div>
    </aside>
  )
}
