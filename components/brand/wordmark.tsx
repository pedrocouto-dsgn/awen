import Link from "next/link"

import { cn } from "@/lib/utils"

/** Text wordmark. Display weight stays at 500. */
export function Wordmark({ className, href }: { className?: string; href?: string }) {
  const text = <span className={cn("font-heading font-medium tracking-tight text-foreground", className)}>Awen</span>
  return href ? (
    <Link href={href} aria-label="Awen, início">
      {text}
    </Link>
  ) : (
    text
  )
}
