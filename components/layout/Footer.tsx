"use client";

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
            <p className="m-0 font-mono lg:font-sans">© 2026 {siteConfig.name}. All rights reserved.</p>
            <p className="m-0 break-keep">
              AI 회의 에이전트는 사용자의 업무 효율을 높이는 보조 수단입니다.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
