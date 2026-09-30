import { Wordmark } from "@/components/brand/wordmark"

import { MobileNav } from "./mobile-nav"
import { NavLinks } from "./nav-links"
import { UserMenu } from "./user-menu"

export function AppHeader({ email, actions }: { email: string | null; actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex h-14 items-center gap-2 px-4 md:gap-6 md:px-6">
        <MobileNav />
        <Wordmark href="/library" />
        <NavLinks className="hidden md:flex" />
        <div className="ml-auto flex items-center gap-1">
          {actions}
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  )
}
