"use client"

import { MenuIcon } from "lucide-react"
import { useState } from "react"

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { NavData } from "@/lib/shell/nav-data"

import { SidebarContent } from "./sidebar-content"

/** Phone: a floating menu button opens the same sidebar content, always expanded, in a drawer. */
export function MobileNav({ data }: { data: NavData }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu"
          className="glass fixed top-3 left-3 z-40 flex size-10 items-center justify-center rounded-xl text-foreground md:hidden"
        >
          <MenuIcon className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-0 rounded-r-2xl" showCloseButton={false}>
        <SheetTitle className="sr-only">Navegação</SheetTitle>
        <SidebarContent data={data} expanded onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
