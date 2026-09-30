"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { href: "/library", label: "Biblioteca" },
  { href: "/review", label: "Revisão" },
  { href: "/people", label: "Pessoas" },
  { href: "/projects", label: "Projetos" },
] as const

export function NavLinks({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname()
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
          </Link>
        )
      })}
    </nav>
  )
}
