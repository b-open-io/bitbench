import { PageContainer } from "@/components/page-container"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 h-16 w-full border-b border-border bg-background/80 backdrop-blur-xl" />
      <PageContainer forceWidth="default" className="py-10">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-8 w-2/3 max-w-md" />
            <Skeleton className="h-4 w-1/2 max-w-sm" />
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
              key={i}
              className="h-24 w-full rounded-lg"
            />
          ))}
        </div>

        <Skeleton className="mt-8 h-[420px] w-full rounded-lg" />
      </PageContainer>
    </div>
  )
}
