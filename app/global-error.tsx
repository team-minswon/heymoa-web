"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { AlertOctagon, Home, RotateCcw } from "lucide-react";

import { messagesFor } from "@/i18n/messages";
import {
  DEFAULT_LOCALE,
  isLocale,
  LANG_COOKIE,
  localePath,
  splitLocale,
  type Locale,
} from "@/lib/i18n/locales";
import "./globals.css";

const subscribe = () => () => {};

/**
 * 루트 레이아웃이 실패했을 때라 `[lang]` 도 서버 쿠키도 못 받는다. 브라우저에서 주소(`/en/...`)를 먼저 보고,
 * 없으면 사용자가 고른 `heymoa-lang` 쿠키를 본다. 서버에서 그릴 때는 한국어다.
 */
function browserLocale(): Locale {
  const { locale } = splitLocale(window.location.pathname);
  if (locale !== DEFAULT_LOCALE) return locale;
  const chosen = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${LANG_COOKIE}=`))
    ?.slice(LANG_COOKIE.length + 1);
  return isLocale(chosen) ? chosen : DEFAULT_LOCALE;
}

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useSyncExternalStore(
    subscribe,
    browserLocale,
    () => DEFAULT_LOCALE
  );
  const text = messagesFor(locale).common;
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full">
        <main className="flex min-h-screen items-center justify-center bg-[var(--el-canvas)] px-4 py-12 text-[var(--el-ink)]">
          <div className="w-full max-w-lg rounded-panel border border-[var(--el-hairline)] bg-white p-8 text-center shadow-[0_16px_48px_rgba(12,10,9,0.08)] sm:p-12">
            <AlertOctagon className="mx-auto mb-5 size-10 text-[var(--el-error)]" />
            <h1 className="text-3xl font-light tracking-[-0.025em]">
              {text.globalError.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
              {text.globalError.description}
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--el-primary)] px-5 text-sm font-medium text-white transition"
              >
                <RotateCcw className="size-4" />
                {text.error.retry}
              </button>
              <Link
                href={localePath(locale, "/")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--el-hairline-strong)] bg-white px-5 text-sm font-medium text-[var(--el-ink)] transition"
              >
                <Home className="size-4" />
                {text.error.home}
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
