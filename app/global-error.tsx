"use client";

import Link from "next/link";
import { AlertOctagon, Home, RotateCcw } from "lucide-react";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <main className="flex min-h-screen items-center justify-center bg-[var(--el-canvas)] px-4 py-12 text-[var(--el-ink)]">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--el-hairline)] bg-white p-8 text-center shadow-[0_16px_48px_rgba(12,10,9,0.08)] sm:p-12">
            <AlertOctagon className="mx-auto mb-5 size-10 text-[var(--el-error)]" />
            <h1 className="font-serif text-3xl font-light tracking-[-0.025em]">
              심각한 오류가 발생했습니다
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
              애플리케이션을 로드할 수 없습니다. 다시 시도해 주세요.
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--el-primary)] px-5 text-sm font-medium text-white transition"
              >
                <RotateCcw className="size-4" />
                다시 시도
              </button>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--el-hairline-strong)] bg-white px-5 text-sm font-medium text-[var(--el-ink)] transition"
              >
                <Home className="size-4" />
                홈으로
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
