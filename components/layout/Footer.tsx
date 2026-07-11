"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
      <footer className="border-t border-[var(--el-hairline)] bg-[var(--el-canvas)] text-[var(--el-body)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-[15px] text-[var(--el-muted)] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© 2026 {siteConfig.name}. All rights reserved.</span>
          <span>
            AI 회의 에이전트는 사용자의 업무 효율을 높이는 보조 수단입니다.
          </span>
        </div>
      </footer>
    );
  }

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
            회의를 기록하고 참여하며, 대화를 실제 업무로 연결하는 참여형 AI Agent
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
                  onClick={() => handleScroll("features")}
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)] cursor-pointer"
                >
                  기능 소개
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleScroll("how-it-works")}
                  className="text-[15px] font-medium text-[var(--el-muted)] transition hover:text-[var(--el-ink)] cursor-pointer"
                >
                  작동 방식
                </button>
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
