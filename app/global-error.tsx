"use client";

import Link from "next/link";
import { AlertOctagon, Home, RotateCcw } from "lucide-react";

import { StatusPanel } from "@/components/realillust/status-panel";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <main className="flex min-h-screen items-center bg-[var(--clay-canvas)] px-4 py-12 text-[var(--clay-primary)]">
          <StatusPanel
            icon={AlertOctagon}
            label="Fatal Error"
            title="서비스 화면을 복구하지 못했습니다"
            description="페이지를 다시 불러오거나 홈으로 이동해 주세요."
            actions={
              <>
                <button
                  type="button"
                  onClick={() => reset()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--clay-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--clay-brand-teal)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <RotateCcw className="size-4" />
                  다시 시도
                </button>
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] px-4 text-sm font-semibold text-[var(--clay-primary)] transition hover:bg-[var(--clay-surface-soft)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Home className="size-4" />
                  홈으로
                </Link>
              </>
            }
          />
        </main>
      </body>
    </html>
  );
}
