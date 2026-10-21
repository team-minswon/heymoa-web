"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { messagesFor } from "@/i18n/messages";
import { localePath, type Locale } from "@/lib/i18n/locales";

/**
 * 라우트 오류 본문. 제품 `app/(product)/error` 와 마케팅 `app/[lang]/error` 가 같이 쓴다. 홈은 그 언어의 랜딩이다.
 */
export function ErrorView({
  locale,
  reset,
}: {
  locale: Locale;
  reset: () => void;
}) {
  const text = messagesFor(locale).common.error;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--el-canvas)] px-4 py-12 text-[var(--el-ink)]">
      <div className="w-full max-w-lg rounded-panel border border-[var(--el-hairline)] bg-white p-8 text-center shadow-[0_16px_48px_rgba(12,10,9,0.08)] sm:p-12">
        <AlertTriangle className="mx-auto mb-5 size-10 text-[var(--el-error)]" />
        <h1 className="text-3xl font-light tracking-[-0.025em]">
          {text.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
          {text.description}
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--el-primary)] px-5 text-sm font-medium text-white transition hover:bg-[var(--el-primary-active)]"
          >
            <RotateCcw className="size-4" />
            {text.retry}
          </button>
          <Link
            href={localePath(locale, "/")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--el-hairline-strong)] bg-white px-5 text-sm font-medium text-[var(--el-ink)] transition hover:bg-[var(--el-canvas-soft)]"
          >
            <Home className="size-4" />
            {text.home}
          </Link>
        </div>
      </div>
    </main>
  );
}
