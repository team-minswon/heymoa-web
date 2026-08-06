import { Skeleton } from "@/components/ui/skeleton";

/**
 * `?view=full` 노트로 **바로 들어올 때**의 fallback. 셸 데이터(워크스페이스·프로젝트)가
 * 매달려 있는 동안 뜬다.
 *
 * **여기서 워크스페이스 골격을 그리면 안 된다.** 전체 뷰는 뷰포트를 통째로 덮어서 사이드바도
 * 워크스페이스 상단바도 보이지 않는데(design.pen `XtEMZ`), `WorkspaceRouteSkeleton`은 그
 * 둘을 그린다 — 새로고침하면 **보일 리 없는 사이드바가 잠깐 뜬 다음 노트가 그 위를 덮었다.**
 * 로딩이 끝나는 순간 화면이 통째로 갈리는 것이라 「같은 화면이 채워지는 중」으로 읽히지 않는다.
 *
 * 기하는 최종 화면에 맞춘다 — 캔버스 사방 10, 왼쪽 본문 패널 + 오른쪽 레일 440, 그 사이 10.
 * 패널 안은 상단바 56 → 노트 헤더다.
 */
export function NoteFullSkeleton() {
  return (
    <div
      aria-label="노트 불러오는 중"
      className="fixed inset-0 z-30 flex gap-2.5 overflow-hidden bg-[var(--el-canvas)] p-2.5"
    >
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e2">
        {/* 상단바 56 — 실제 바와 높이가 같아야 로딩이 끝날 때 본문이 안 밀린다. */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--el-hairline)] px-4 sm:px-8">
          <Skeleton className="size-8 shrink-0 rounded-control" />
          <Skeleton className="size-8 shrink-0 rounded-control" />
          <div className="h-[18px] w-px bg-[var(--el-hairline)]" />
          <Skeleton className="h-3.5 w-28 rounded-chip" />
        </div>
        {/* 노트 헤더 — 배지 줄 → 세리프 제목 34 → 메타 두 줄 → 탭. 좌우 여백은 전체 뷰의 64다. */}
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
      {/* 레일은 상주다 — 440 고정(design.pen `L4PpR`). 좁은 화면에서는 본문만 남는다. */}
      <div className="hidden w-[440px] shrink-0 flex-col overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e2 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-[var(--el-hairline)] px-4">
          <Skeleton className="h-10 w-44 rounded-control" />
        </div>
      </div>
    </div>
  );
}
