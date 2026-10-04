import { ExternalLinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ReferenceView } from "@/lib/references/view"
import { cn } from "@/lib/utils"

const SITES: [RegExp, string][] = [
  [/(^|\.)pinterest\.[a-z.]+$|^pin\.it$/, "Pinterest"],
  [/(^|\.)instagram\.com$|^instagr\.am$/, "Instagram"],
  [/(^|\.)youtube(-nocookie)?\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)vimeo\.com$/, "Vimeo"],
  [/(^|\.)behance\.net$/, "Behance"],
  [/(^|\.)dribbble\.com$/, "Dribbble"],
]

/** "Abrir no Pinterest" (Instagram, YouTube…; "Abrir fonte" for other sites): opens the page the reference came from. */
export function SourceLink({ reference, className }: { reference: ReferenceView; className?: string }) {
  const url = reference.source_url
  if (!url) return null

  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
  const site = SITES.find(([re]) => re.test(host))?.[1]

  return (
    <Button variant="outline" size="sm" className={cn("glass-strong", className)} asChild>
      <a href={url} target="_blank" rel="noopener noreferrer" title={host}>
        {site ? `Abrir no ${site}` : "Abrir fonte"} <ExternalLinkIcon aria-hidden />
      </a>
    </Button>
  )
}
