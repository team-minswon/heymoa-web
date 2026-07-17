import { LoaderCircle } from "lucide-react";

export default function AuthCallbackLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--el-canvas)] px-4 py-12 text-[var(--el-ink)]">
      <div className="text-center">
        <LoaderCircle className="mx-auto mb-5 size-8 animate-spin text-[var(--el-ink)]" />
        <h1 className="font-serif text-3xl font-light tracking-[-0.025em]">
          로그인 중입니다
        </h1>
        <p className="mt-2 text-sm text-[var(--el-muted)]">
          워크스페이스를 준비하고 있습니다.
        </p>
      </div>
    </div>
  );
}
