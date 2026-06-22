import Link from "next/link";
import { FileText, Shield } from "lucide-react";

import { AuthStatus } from "@/components/auth/auth-status";
import { siteConfig } from "@/lib/site";

const navItems = [
  { href: "/terms", label: "이용약관", icon: FileText },
  { href: "/privacy", label: "개인정보", icon: Shield },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--cg-cream)] text-[var(--cg-ink)]">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[var(--cg-green)] text-white shadow-sm">
              <Shield className="size-5" />
            </span>
            <span>
              <span className="block text-[17px] font-semibold leading-tight">
                {siteConfig.name}
              </span>
              <span className="block text-xs font-medium text-black/55">
                AI 일러스트 검사
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-black/70 transition hover:bg-[var(--cg-ceramic)] hover:text-[var(--cg-green)]"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <AuthStatus />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-black/10 bg-[var(--cg-house)] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr] lg:px-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-white text-[var(--cg-green)]">
                <Shield className="size-5" />
              </span>
              <span>
                <span className="block text-lg font-semibold">
                  {siteConfig.name}
                </span>
                <span className="block text-xs font-medium text-white/62">
                  {siteConfig.domain}
                </span>
              </span>
            </Link>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/68">
              AI 생성 의심 이미지, 메타데이터, 국소 영역 신호를 함께 검토해
              창작 이미지 판단을 돕습니다.
            </p>
            <p className="mt-4 text-sm text-white/62">
              문의:{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                {siteConfig.contactEmail}
              </a>
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--cg-gold)]">
                서비스
              </h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link
                    href="/"
                    className="text-sm font-medium text-white/68 transition hover:text-white"
                  >
                    홈
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--cg-gold)]">
                정책
              </h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link
                    href="/terms"
                    className="text-sm font-medium text-white/68 transition hover:text-white"
                  >
                    이용약관
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-sm font-medium text-white/68 transition hover:text-white"
                  >
                    개인정보 처리방침
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/52 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <span>© 2026 {siteConfig.name}. All rights reserved.</span>
            <span>
              AI 검사 결과는 보조 판단 자료이며 최종 판단은 운영 기준에 따라
              이루어집니다.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
