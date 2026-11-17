import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export function NoteFullSkeleton() {
  const t = useTranslations("notes.panel");
  return (
    <div
      aria-label={t("loading")}
      className="fixed inset-0 z-30 flex gap-2.5 overflow-hidden bg-[var(--el-canvas)] p-2.5"
    >
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e2">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--el-hairline)] px-4 sm:px-8">
          <Skeleton className="size-8 shrink-0 rounded-control" />
          <Skeleton className="size-8 shrink-0 rounded-control" />
          <div className="h-[18px] w-px bg-[var(--el-hairline)]" />
          <Skeleton className="h-3.5 w-28 rounded-chip" />
        </div>
        <div className="shrink-0 border-b border-[var(--el-hairline)] px-5 pb-4 pt-5 sm:px-9 lg:px-16">
          <Skeleton className="h-4 w-24 rounded-chip" />
          <Skeleton className="mt-2 h-9 w-64 max-w-full rounded-chip" />
          <Skeleton className="mt-2.5 h-8 w-72 max-w-full rounded-chip" />
          <Skeleton className="mt-3 h-10 w-40 rounded-control" />
        </div>
        <div className="min-h-0 flex-1 space-y-4 px-5 pt-5 sm:px-9 lg:px-16">
          <Skeleton className="h-5 w-4/5 rounded-chip" />
          <Skeleton className="h-5 w-3/5 rounded-chip" />
        </div>
      </div>
      <div className="hidden w-[440px] shrink-0 flex-col overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e2 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-[var(--el-hairline)] px-4">
          <Skeleton className="h-10 w-44 rounded-control" />
        </div>
      </div>
    </div>
  );
}
