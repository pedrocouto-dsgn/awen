import { FolderIcon } from "lucide-react"
import Link from "next/link"

import type { ActiveProject } from "@/lib/references/links"

/** Top-bar chip for the active project (design: "active-project chip sits in the top bar"). */
export function ActiveProjectChip({ project }: { project: ActiveProject }) {
  if (!project) return null
  return (
    <Link
      href={`/projects/${project.id}`}
      title="Projeto ativo"
      className="type-label hidden h-9 max-w-56 items-center gap-2 border border-border-strong px-3 text-foreground hover:bg-accent lg:flex"
    >
      <FolderIcon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{project.name}</span>
    </Link>
  )
}
