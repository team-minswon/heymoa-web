"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shield } from "lucide-react";

import { siteConfig } from "@/lib/site";

export function Footer({ simplified = false }: { simplified?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleScroll = (id: string) => {
    if (pathname === "/") {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      router.push(`/#${id}`);
    }
  };

  if (simplified) {
    return (
      <footer className="border-t border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] text-[var(--clay-body)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-[var(--clay-muted-soft)] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© 2026 {siteConfig.name}. All rights reserved.</span>
          <span>
            AI 검사 결과는 보조 판단 자료이며 최종 판단은 운영 기준에 따라
            이루어집니다.
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] text-[var(--clay-body)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr] lg:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--clay-primary)] text-white shadow-none">
              <Shield className="size-5" />
            </span>
            <span>
              <span className="block text-lg font-bold text-[var(--clay-primary)]">
                {siteConfig.name}
              </span>
              <span className="block text-xs font-medium text-[var(--clay-muted)]">
                realillust
              </span>
            </span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-6 text-[var(--clay-muted)]">
            AI 생성 여부 확정이 아닌, 시각적 검토를 돕는 Evidence 기반 이미지
            분석 서비스
          </p>
          <p className="mt-4 text-sm text-[var(--clay-muted)]">
            문의:{" "}
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="font-semibold text-[var(--clay-primary)] underline-offset-4 hover:underline"
            >
              {siteConfig.contactEmail}
            </a>
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--clay-primary)]">
              서비스
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <button
                  onClick={() => handleScroll("analyze-box")}
                  className="text-sm font-medium text-[var(--clay-muted)] transition hover:text-[var(--clay-primary)] cursor-pointer"
                >
                  분석하기
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleScroll("example-section")}
                  className="text-sm font-medium text-[var(--clay-muted)] transition hover:text-[var(--clay-primary)] cursor-pointer"
                >
                  결과 예시
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--clay-primary)]">
              정책
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/terms"
                  className="text-sm font-medium text-[var(--clay-muted)] transition hover:text-[var(--clay-primary)]"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm font-medium text-[var(--clay-muted)] transition hover:text-[var(--clay-primary)]"
                >
                  개인정보 처리방침
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--clay-hairline)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-[var(--clay-muted-soft)] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© 2026 {siteConfig.name}. All rights reserved.</span>
          <span>
            AI 검사 결과는 보조 판단 자료이며 최종 판단은 운영 기준에 따라
            이루어집니다.
          </span>
        </div>
      </div>
    </footer>
  );
}
