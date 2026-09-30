"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useOptionalAnalysis } from "@/features/analysis/analysis-provider"
import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { href: "/library", label: "Biblioteca" },
  { href: "/review", label: "Revisão" },
  { href: "/people", label: "Pessoas" },
  { href: "/projects", label: "Projetos" },
] as const

export function NavLinks({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const toReview = useOptionalAnalysis()?.stats.toReview ?? 0
  return (
    <nav className={cn("flex items-center gap-1", className)} aria-label="Principal">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            {item.label}
            {item.href === "/review" && toReview > 0 ? (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-medium text-primary-foreground tabular-nums">
                {toReview > 99 ? "99+" : toReview}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
