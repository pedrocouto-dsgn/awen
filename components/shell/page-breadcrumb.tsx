import { HouseIcon } from "lucide-react"
import Link from "next/link"
import { Fragment } from "react"

import { cn } from "@/lib/utils"

export type Crumb = { label: string; href?: string }

/**
 * Trail at the top of every page except the library feed, as in the "Quantix"
 * reference: house icon (the library), then "Section / Page". The last item is
 * the current page.
 */
export function PageBreadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn("flex h-12 shrink-0 items-center px-4 md:px-5", className)}>
      <ol className="flex min-w-0 items-center gap-2.5 text-sm">
        <li className="flex shrink-0">
          <Link
            href="/library"
            aria-label="Biblioteca"
            title="Biblioteca"
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-glass-hover hover:text-foreground"
          >
            <HouseIcon className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </Link>
        </li>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <Fragment key={`${i}:${item.label}`}>
              <li aria-hidden className="text-muted-foreground/50">
                /
              </li>
              <li className={cn("min-w-0", last ? "truncate" : "shrink-0")}>
                {last || !item.href ? (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={cn("block truncate", last ? "font-medium text-foreground" : "text-muted-foreground")}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
