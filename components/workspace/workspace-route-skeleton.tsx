import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceRouteSkeleton() {
  return (
    <div
      aria-label="워크스페이스 불러오는 중"
      className="flex min-h-svh bg-[var(--el-canvas)]"
    >
      <aside className="hidden w-64 shrink-0 border-r border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] md:block">
        <div className="flex h-[53px] items-center gap-2.5 px-3">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-2.5 w-32 rounded-md" />
          </div>
        </div>
        <div className="h-px bg-[var(--el-hairline)]" />
        <div className="flex h-10 items-center gap-2.5 px-3">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className="h-3 w-28 rounded-md" />
        </div>
        <div className="h-px bg-[var(--el-hairline)]" />
        <div className="space-y-1 px-2 py-4">
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="flex h-14 items-center border-b border-[var(--el-hairline)] px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-5 w-28 rounded-md" />
        </div>
        <section className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-8 sm:px-8 sm:pt-11 lg:px-14 xl:px-20">
          <header className="mb-10 flex flex-col gap-7 border-b border-[var(--el-hairline)] pb-9 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="mt-3 h-12 w-64 max-w-full rounded-xl" />
              <Skeleton className="mt-4 h-4 w-80 max-w-full rounded-md" />
            </div>
            <Skeleton className="h-10 w-36 shrink-0 rounded-full" />
          </header>
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[92px] rounded-2xl" />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
