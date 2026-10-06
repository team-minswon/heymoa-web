"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { siteConfig } from "@/lib/site";

/**
 * 범용 푸터. 랜딩 크롬 경로(`isLandingChromeRoute`)는 `FooterGate` 가 랜딩 푸터를 세우므로 여기 오지 않고,
 * 그 밖(`/invite` · `/mock-oauth` · `/settings/integrations` 등)만 이것을 쓴다. 그래서 `/` 에 있을 때의
 * 제자리 스크롤 갈래도 없다 — 구간 링크는 늘 랜딩으로 이동한다.
 */
export function Footer() {
  const router = useRouter();

  const handleScroll = (id: string) => {
    router.push(`/#${id}`);
  };

  return (
    <footer className="border-t border-[var(--el-hairline)] bg-[var(--el-canvas)] text-[var(--el-body)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr] lg:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/apple-touch-icon.png"
              alt={siteConfig.name}
              width={36}
              height={36}
              className="rounded-full object-contain"
              priority
              loading="eager"
            />
            <span>
              <span className="block text-[16px] font-medium tracking-tight text-[var(--el-ink)]">
                {siteConfig.name}
              </span>
            </span>
          </Link>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--el-muted)]">
            회의를 받아 적고, 결정과 할 일을 근거와 함께 정리하는 AI 에이전트
          </p>
          <p className="mt-4 text-[15px] text-[var(--el-muted)]">
            문의:{" "}
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="font-medium text-[var(--el-ink)] underline underline-offset-4 hover:text-[var(--el-primary-active)]"
            >
              {siteConfig.contactEmail}
            </a>
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-[12px] font-semibold tracking-wider text-[var(--el-ink)] uppercase">
              서비스
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <button
                  onClick={() => handleScroll("meetings")}
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)] cursor-pointer"
                >
                  회의 정리
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleScroll("evidence")}
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)] cursor-pointer"
                >
                  근거 확인
                </button>
              </li>
              <li>
                <Link
                  href="/download"
                  className="text-[15px] font-medium text-[var(--el-muted)] hover:text-[var(--el-ink)]"
                >
                  데스크톱 다운로드
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-[12px] font-semibold tracking-wider text-[var(--el-ink)] uppercase">
              정책
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/terms"
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)]"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)]"
                >
                  개인정보 처리방침
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--el-hairline-soft)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-[15px] text-[var(--el-muted)] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© 2026 {siteConfig.name}. All rights reserved.</span>
          <span>
            AI 회의 에이전트는 사용자의 업무 효율을 높이는 보조 수단입니다.
          </span>
        </div>
      </div>
    </footer>
  );
}
