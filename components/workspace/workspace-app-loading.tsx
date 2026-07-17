import { LoaderCircle } from "lucide-react";

export function WorkspaceAppLoading() {
  return (
    <div
      role="status"
      aria-label="워크스페이스 불러오는 중"
      className="flex min-h-[100dvh] w-full flex-1 items-center justify-center bg-[var(--el-canvas)] px-4 text-[var(--el-ink)]"
    >
      <div className="text-center">
        <LoaderCircle
          aria-hidden
          className="mx-auto mb-5 size-8 animate-spin text-[var(--el-ink)]"
        />
        <p className="font-serif text-2xl font-light tracking-[-0.025em]">
          워크스페이스 준비 중
        </p>
        <p className="mt-2 text-sm text-[var(--el-muted)]">
          회의 기록을 불러오고 있습니다.
        </p>
      </div>
    </div>
  );
}
