import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--el-canvas)] p-4 text-center">
      <SearchX className="mb-5 size-10 text-[var(--el-muted)]" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--el-muted)]">
        Error 404
      </p>
      <h1 className="mt-3 font-serif text-3xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-3 text-sm text-[var(--el-muted)]">
        주소가 바뀌었거나 더 이상 제공하지 않는 페이지입니다.
      </p>
      <Link
        href="/"
        className="mt-7 rounded-full bg-[var(--el-primary)] px-5 py-2.5 text-sm font-medium text-white"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
