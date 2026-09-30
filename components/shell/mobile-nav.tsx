"use client"

import { MenuIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

import { NavLinks, SETTINGS_ITEM } from "./nav-links"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Abrir menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0">
        <SheetHeader className="h-16 justify-center px-6">
          <SheetTitle className="font-heading text-2xl font-medium tracking-tight">Awen</SheetTitle>
        </SheetHeader>
        <NavLinks className="flex-1 gap-1 pt-2" onNavigate={() => setOpen(false)} />
        <NavLinks items={[SETTINGS_ITEM]} className="pb-6" onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
