import { Wordmark } from "@/components/brand/wordmark"

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-gradient-glow p-6">
      <div className="flex w-full max-w-md flex-col gap-10">
        <div className="flex justify-center">
          <Wordmark className="type-display-mega" />
        </div>
        <div className="border border-border-strong bg-card bg-gradient-dusk p-8">{children}</div>
      </div>
    </main>
  )
}
