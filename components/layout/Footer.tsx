"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { siteConfig } from "@/lib/site";

/** 랜딩·약관이 같이 쓰는 마케팅 면 푸터. 제품 흐름은 아래 범용 푸터를 쓴다. */
const MARKETING_PATHS = new Set(["/", "/terms", "/privacy"]);

export function Footer() {
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

  /**
   * **랜딩 껍데기는 마케팅 면에서만 쓴다.** `FooterGate`는 루트 레이아웃에 있어서
   * `/invite` · `/mock-oauth` · `/settings/integrations`도 여기로 온다 — 경로를 안 가리면
   * 랜딩 전용 파도와 다크 면이 그 제품 흐름까지 번진다. 그쪽은 예전 범용 푸터 그대로 둔다.
   */
  if (!MARKETING_PATHS.has(pathname)) {
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
              회의를 기록하고 참여하며, 대화를 실제 업무로 연결하는 참여형 AI
              Agent
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

  return (
    <footer className="landing-footer">
      {/* 크림 면에서 어두운 띠로 넘어가는 자리. 직선으로 자르면 면이 두 장으로 보인다. */}
      <svg
        aria-hidden
        viewBox="0 0 1440 58"
        preserveAspectRatio="none"
        className="block h-[34px] w-full lg:h-[58px]"
      >
        <path
          d="M0 58l0-28c220-34 420 20 700-4 240-21 480 24 740-10l0 42z"
          fill="var(--lp-dark)"
        />
      </svg>

      <div className="flex flex-col items-center bg-[var(--lp-dark)] px-5 pt-9 pb-10 lg:px-10 lg:pt-11 lg:pb-12">
        <div className="flex w-full max-w-[1120px] flex-col gap-8 lg:gap-11">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
            <div className="flex flex-1 flex-col gap-3">
              <Link
                href="/"
                className="font-serif text-[25px] font-semibold tracking-[-0.2px] text-[var(--lp-on-dark)] lg:text-[28px]"
              >
                {siteConfig.name}
              </Link>
              <p className="m-0 max-w-[400px] break-keep text-[13px] leading-[1.7] text-[var(--lp-on-dark-soft)] lg:text-[14px]">
                회의를 기록하고 참여하며, 대화를 실제 업무로 연결하는 참여형 AI
                Agent
              </p>
              <div className="flex items-center gap-[7px]">
                <span className="text-[14px] font-semibold text-[var(--lp-on-dark)] lg:text-[13px]">
                  문의
                </span>
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="inline-block py-1 font-mono text-[14px] text-[var(--lp-green-soft)] underline-offset-4 hover:underline lg:text-[13px]"
                >
                  {siteConfig.contactEmail}
                </a>
              </div>
            </div>

            {/* 모바일에서는 두 단이 나란히 선다(간격 40). `lg:contents`로 넓은 화면에서는
                이 래퍼를 없애 바깥 행의 직계 자식으로 돌려보낸다. */}
            <div className="flex gap-10 lg:contents">
              <div className="flex flex-col gap-3 lg:w-[200px] lg:gap-3.5">
                <h2 className="m-0 break-keep text-[14px] font-bold text-[var(--lp-on-dark)] lg:text-[13px]">
                  서비스
                </h2>
                <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:gap-3.5">
                  {(
                    [
                      ["features", "기능 소개"],
                      ["how-it-works", "작동 방식"],
                    ] as const
                  ).map(([id, label]) => (
                    <li key={id}>
                      <button
                        onClick={() => handleScroll(id)}
                        className="inline-block cursor-pointer py-1 text-[13px] text-[var(--lp-on-dark-soft)] underline-offset-4 hover:underline lg:text-[13.5px]"
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 lg:w-[200px] lg:gap-3.5">
                <h2 className="m-0 break-keep text-[14px] font-bold text-[var(--lp-on-dark)] lg:text-[13px]">
                  정책
                </h2>
                <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:gap-3.5">
                  {(
                    [
                      ["/terms", "이용약관"],
                      ["/privacy", "개인정보 처리방침"],
                    ] as const
                  ).map(([href, label]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="inline-block py-1 text-[13px] text-[var(--lp-on-dark-soft)] underline-offset-4 hover:underline lg:text-[13.5px]"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[7px] border-t border-[var(--lp-dark-rule)] pt-5 text-[11px] leading-[1.6] text-[var(--lp-on-dark-soft)] lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:pt-6 lg:text-[12.5px]">
            <p className="m-0 font-mono lg:font-sans">
              © 2026 {siteConfig.name}. All rights reserved.
            </p>
            <p className="m-0 break-keep">
              AI 회의 에이전트는 사용자의 업무 효율을 높이는 보조 수단입니다.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
