import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceAppLoading() {
  return (
    <div
      role="status"
      aria-label="워크스페이스 불러오는 중"
      className="flex min-h-[100dvh] w-full flex-1 bg-[var(--el-canvas)] text-[var(--el-ink)]"
    >
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-5 md:flex">
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="mt-3 h-10 rounded-2xl" />
        <div className="mt-10 space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 rounded-xl" />
          <Skeleton className="h-9 rounded-xl" />
          <Skeleton className="h-9 rounded-xl" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex h-14 items-center border-b border-[var(--el-hairline)] px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-5 w-36" />
        </div>
        <section className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-8 sm:px-8 sm:pt-11 lg:px-14 xl:px-20">
          <div className="flex items-end justify-between gap-6 border-b border-[var(--el-hairline)] pb-9">
            <div className="space-y-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-12 w-56" />
              <Skeleton className="h-5 w-72 max-w-full" />
            </div>
            <Skeleton className="hidden h-10 w-36 rounded-full sm:block" />
          </div>
          <div className="mt-8 space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </section>
      </div>
      <span className="sr-only">워크스페이스를 준비하고 있습니다.</span>
    </div>
  );
}
