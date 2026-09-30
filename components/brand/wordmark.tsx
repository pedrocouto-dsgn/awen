import Link from "next/link"

import { cn } from "@/lib/utils"

export function Wordmark({ className, href }: { className?: string; href?: string }) {
  const text = <span className={cn("font-heading text-lg font-semibold tracking-tight", className)}>Awen</span>
  return href ? (
    <Link href={href} aria-label="Awen, início" className="rounded-sm focus-visible:outline-2">
      {text}
    </Link>
  ) : (
    text
  )
}
