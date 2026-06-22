import Link from "next/link";
import { Shield } from "lucide-react";

import { siteConfig } from "@/lib/site";

export function StaticShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--cg-cream)] text-[var(--cg-ink)]">
      <header className="border-b border-[var(--clay-hairline)] bg-[var(--clay-canvas)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--clay-primary)] text-white">
              <Shield className="size-5" />
            </span>
            <span>
              <span className="block text-[17px] font-semibold leading-tight">
                {siteConfig.name}
              </span>
              <span className="block text-xs font-medium text-[var(--clay-muted)]">
                AI 일러스트 검사
              </span>
            </span>
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] text-[var(--clay-body)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-[var(--clay-muted-soft)] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© 2026 {siteConfig.name}. All rights reserved.</span>
          <span>
            AI 검사 결과는 보조 판단 자료이며 최종 판단은 운영 기준에 따라
            이루어집니다.
          </span>
        </div>
      </footer>
    </div>
  );
}
