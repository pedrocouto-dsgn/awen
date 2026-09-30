import { Wordmark } from "@/components/brand/wordmark"

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <Wordmark className="text-3xl" />
        </div>
        {children}
      </div>
    </main>
  )
}
