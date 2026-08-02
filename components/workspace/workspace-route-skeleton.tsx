import { Skeleton } from "@/components/ui/skeleton";

/**
 * 워크스페이스 셸이 **아직 없을 때**의 fallback. 쓰는 자리는 둘뿐이다.
 *
 * - `app/w/loading.tsx` — `/w` 아래 전체를 감싼다. 하위 `[workspaceId]/layout.tsx`가
 *   `prefetchWorkspaceShell()`을 await하므로 워크스페이스에 처음 진입할 때 여기가 뜬다
 * - route `layout.tsx`의 `DataBoundary` — 셸 데이터가 실패·재시도로 다시 매달릴 때
 *
 * **페이지 세그먼트용 `loading.tsx`에는 쓰지 않는다.** 그 시점엔 셸이 이미 떠 있어서
 * 사이드바 위에 사이드바를 또 그리게 된다 — APP-215에서 실제로 그랬다.
 *
 * 노트 라우트에도 route fallback을 두지 않는다. 목록 행이 `useLinkStatus`로 이미 진행을
 * 표시하고, `loading.tsx`는 `searchParams`를 못 받아 side(시트)와 full(전체 면)을 구분할
 * 수 없다 — 기본 경로인 side 진입에서 full 화면을 덮었다가 시트로 바뀐다.
 *
 * 기하는 최종 화면에 맞춘다 — 사이드바 255, 상단바 64, 목록은 날짜 헤더 + 52 행이다.
 */
export function WorkspaceRouteSkeleton() {
  return (
    <div
      aria-label="워크스페이스 불러오는 중"
      className="flex min-h-svh bg-[var(--el-canvas)]"
    >
      <aside className="hidden w-[255px] shrink-0 border-r border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] md:flex md:flex-col">
        {/* 상단: 워크스페이스 1줄 56 (CHROME SPEC) */}
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
        {/* 하단: UserBar (상단 hairline) */}
        <div className="h-px bg-[var(--el-hairline)]" />
        <div className="flex h-14 items-center gap-2.5 px-3">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-20 rounded-chip" />
            <Skeleton className="h-2.5 w-28 rounded-chip" />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        {/* 상단바 1단 64와 같은 높이여야 로딩이 끝날 때 본문이 안 밀린다. (CHROME SPEC) */}
        <div className="flex h-16 items-center border-b border-[var(--el-hairline)] px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-5 w-28 rounded-chip" />
        </div>
        {/* 폭·padding은 `workspace-page.tsx`의 섹션과 같아야 한다 — 다르면 로딩이 끝나는
          순간 콘텐츠 폭이 튄다. 실제로 1440과 896으로 갈려 있었다. */}
        <section className="mx-auto w-full max-w-4xl px-5 pt-8 pb-16 sm:px-8 sm:pt-11">
          {/* 제목 34 세리프 + 서브타이틀. 키커는 없다(FORM SPEC). */}
          <Skeleton className="h-9 w-56 max-w-full rounded-chip" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full rounded-chip" />
          {/* 필터 칩 둘 — chip 6 */}
          <div className="mt-6 flex items-center gap-1.5 border-b border-[var(--el-hairline)] pb-4">
            <Skeleton className="h-8 w-[51px] rounded-chip" />
            <Skeleton className="h-8 w-[77px] rounded-chip" />
          </div>
          {/* 날짜 헤더 + 목록 행 52 (행 사이 hairline) */}
          {[3, 2].map((rows, group) => (
            <div key={group}>
              <Skeleton className="mt-5 mb-2 ml-3 h-3 w-36 rounded-chip" />
              <div className="divide-y divide-[var(--el-hairline)]">
                {Array.from({ length: rows }, (_, row) => (
                  // 실제 행(note-list-row)이 두 줄 h-16이다.
                  <div key={row} className="flex h-16 items-center gap-3.5">
                    <Skeleton className="size-5 shrink-0 rounded-chip" />
                    <Skeleton className="h-4 w-1/3 rounded-chip" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
