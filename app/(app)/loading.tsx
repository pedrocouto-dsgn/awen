import { Skeleton } from "@/components/ui/skeleton"

/** Generic page skeleton while server components load. */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-10 w-64" />
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5 [&>div]:mb-4">
        {[0.75, 1.4, 1, 0.6, 1.2, 0.9, 1.5, 0.8, 1.1, 0.7].map((h, i) => (
          <Skeleton key={i} className="w-full break-inside-avoid" style={{ aspectRatio: String(1 / h) }} />
        ))}
      </div>
    </div>
  )
}
