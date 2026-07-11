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
        <main className="flex min-h-screen items-center justify-center bg-[var(--clay-canvas)] px-4 py-12 text-[var(--clay-primary)]">
          <div className="text-center">
            <AlertOctagon className="size-12 mx-auto text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-[var(--clay-primary)]">심각한 오류가 발생했습니다</h1>
            <p className="mt-2 text-[var(--clay-body)]">애플리케이션을 로드할 수 없습니다. 다시 시도해 주세요.</p>
            <div className="mt-6 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--clay-primary)] px-4 text-sm font-semibold text-white transition"
              >
                <RotateCcw className="size-4" />
                다시 시도
              </button>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] px-4 text-sm font-semibold text-[var(--clay-primary)] transition"
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
