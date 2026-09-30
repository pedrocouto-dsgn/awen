"use client"

import { FolderIcon, ImagesIcon, InboxIcon, SettingsIcon, UsersIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useOptionalAnalysis } from "@/features/analysis/analysis-provider"
import { cn } from "@/lib/utils"

type NavItem = { href: string; label: string; icon: LucideIcon }

export const NAV_ITEMS: NavItem[] = [
  { href: "/library", label: "Biblioteca", icon: ImagesIcon },
  { href: "/review", label: "Revisão", icon: InboxIcon },
  { href: "/people", label: "Pessoas", icon: UsersIcon },
  { href: "/projects", label: "Projetos", icon: FolderIcon },
]

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Configurações", icon: SettingsIcon }

/**
 * Vertical navigation. `compact` hides labels between md and lg (icon rail).
 * Active item: steel gradient with Ink text (design: nav-item-active).
 */
export function NavLinks({
  items = NAV_ITEMS,
  compact = false,
  onNavigate,
  className,
}: {
  items?: NavItem[]
  compact?: boolean
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname()
  const toReview = useOptionalAnalysis()?.stats.toReview ?? 0

  return (
    <nav className={cn("flex flex-col", className)} aria-label="Principal">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const count = item.href === "/review" ? toReview : 0
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={compact ? item.label : undefined}
            className={cn(
              "type-nav relative flex h-11 items-center gap-3 px-4 text-muted-foreground transition-colors hover:text-foreground",
              compact && "justify-center px-0 lg:justify-start lg:px-4",
              active && "bg-gradient-steel text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className={cn(compact && "sr-only lg:not-sr-only")}>{item.label}</span>
            {count > 0 ? (
              <span
                className={cn(
                  "type-label ml-auto rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground tabular-nums",
                  compact && "absolute top-1 right-1 px-1.5 lg:static",
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
