"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--el-canvas)] px-4 py-12 text-[var(--el-ink)]">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--el-hairline)] bg-white p-8 text-center shadow-[0_16px_48px_rgba(12,10,9,0.08)] sm:p-12">
        <AlertTriangle className="mx-auto mb-5 size-10 text-[var(--el-error)]" />
        <h1 className="font-serif text-3xl font-light tracking-[-0.025em]">
          화면을 불러오지 못했습니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
          일시적인 오류일 수 있습니다. 다시 시도하거나 홈으로 돌아가 주세요.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--el-primary)] px-5 text-sm font-medium text-white transition hover:bg-[var(--el-primary-active)]"
          >
            <RotateCcw className="size-4" />
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--el-hairline-strong)] bg-white px-5 text-sm font-medium text-[var(--el-ink)] transition hover:bg-[var(--el-canvas-soft)]"
          >
            <Home className="size-4" />
            홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
