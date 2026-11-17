import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * 워크스페이스 셸이 **아직 없을 때**의 fallback 입니다. `app/w/loading.tsx` 와 route `layout.tsx` 의 `DataBoundary` 만 씁니다.
 *
 * - 페이지 세그먼트용 `loading.tsx` 에는 쓰지 않습니다. 그 시점엔 셸이 이미 떠 있어 사이드바 위에 사이드바를 또 그립니다
 * - 노트 라우트에도 route fallback 을 두지 않습니다. 목록 행이 `useLinkStatus` 로 진행을 보이고, `loading.tsx` 는
 *   `searchParams` 를 못 받아 side(시트)와 full(전체 면)을 가르지 못합니다 — side 진입에서 full 화면을 덮었다가 시트로 바뀝니다
 * - 기하는 최종 화면에 맞춥니다. 셸이 로딩과 실제 화면에서 다르게 생기면 로딩이 끝나는 순간 전부 튑니다
 */
export function WorkspaceRouteSkeleton() {
  const t = useTranslations("shell.routeSkeleton");
  return (
    <div
      aria-label={t("loading")}
      className="flex min-h-svh bg-[var(--el-canvas)]"
    >
      <aside className="hidden w-[232px] shrink-0 md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2.5 px-3">
          <Skeleton className="size-7 shrink-0 rounded-chip" />
          <Skeleton className="h-3.5 w-32 rounded-chip" />
        </div>
        <div className="h-px bg-[var(--el-hairline)]" />
        <div className="flex-1 space-y-1 px-3 py-3">
          <Skeleton className="h-9 rounded-full" />
          <div className="h-3" />
          <Skeleton className="h-3 w-16 rounded-chip" />
          <Skeleton className="h-7 w-4/5 rounded-chip" />
          <Skeleton className="h-7 w-3/5 rounded-chip" />
        </div>
        <div className="h-px bg-[var(--el-hairline)]" />
        <div className="flex h-14 items-center gap-2.5 px-3">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-20 rounded-chip" />
            <Skeleton className="h-2.5 w-28 rounded-chip" />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-2.5">
        <div className="min-h-full overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e2">
          <div className="flex h-14 items-center border-b border-[var(--el-hairline)] px-4 sm:px-6 lg:px-8">
            <Skeleton className="h-5 w-28 rounded-chip" />
          </div>
          <section className="mx-auto w-full max-w-4xl px-5 pt-8 pb-16 sm:px-8 sm:pt-11">
            <div className="mb-4 border-b border-[var(--el-hairline)] pb-6">
              <Skeleton className="h-9 w-56 max-w-full rounded-chip" />
              <Skeleton className="mt-3 h-4 w-80 max-w-full rounded-chip" />
            </div>
            {[3, 2].map((rows, group) => (
              <div key={group}>
                <Skeleton className="mt-5 mb-2 ml-3 h-3 w-36 rounded-chip" />
                <div>
                  {Array.from({ length: rows }, (_, row) => (
                    <div key={row} className="flex h-16 items-center gap-3.5">
                      <Skeleton className="size-5 shrink-0 rounded-chip" />
                      <Skeleton className="h-4 w-1/3 rounded-chip" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
