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
    <main className="flex min-h-screen items-center justify-center bg-[var(--clay-canvas)] px-4 py-12 text-[var(--clay-primary)]">
      <div className="text-center">
        <AlertTriangle className="size-12 mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--clay-primary)]">화면을 불러오지 못했습니다</h1>
        <p className="mt-2 text-[var(--clay-body)]">일시적인 오류일 수 있습니다. 다시 시도하거나 홈으로 돌아가 주세요.</p>
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
  );
}
