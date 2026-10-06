import Image from "next/image";
import Link from "next/link";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { siteConfig } from "@/lib/site";

import { CONTAINER, FOCUS, TV_VARS } from "./tokens";

const NAV: Array<[string, string]> = [
  ["회의별로", "#meetings"],
  ["그 말 확인", "#evidence"],
  ["팀", "#team"],
  ["물어보기", "#ask"],
  ["다른 도구로", "#safety"],
];

/**
 * 상단 바. `<main>` 밖(`NavbarGate`)에 서서 `.tv-root` 의 변수를 못 받으니 `TV_VARS` 를 직접 건다.
 * tl;dv 의 흰 가로 바를 따랐고, 앱 Navbar 의 떠 있는 알약은 쓰지 않았다.
 * 로고는 Navbar 와 같은 자산(`/apple-touch-icon.png`)이다. md 미만은 로고 + 시작하기만 남는다.
 * 768 에서 메뉴 다섯이 들어간다(로고 108 + 메뉴 약 385 + 버튼 111 ≈ 645 / 728).
 * 「설치 없음」 말풍선은 두지 않는다 — 랜딩에서 「설치할 것 없음 · 신용카드 없음」 류 문구는 뺐고(72f4c27),
 * 설치 이야기는 FAQ 01 하나에만 둔다.
 * 메뉴 마지막 칸은 safety 구간 제목(「에이전트가 회의 내용을 내가 쓰는 다른 도구로 가져가는 길은 두 개입니다」)의
 * 「다른 도구로 가져가는 길」에서 낱말을 그대로 따 「다른 도구로」다.
 * 예전 「나가는 길」은 「출구」로 읽혀 구간과 이어지지 않았다.
 *
 * 시작하기의 포커스 링은 하나다. `Button` 기본의 `focus-visible:ring-3` · `border-ring` 을 끄고 보라
 * outline(`FOCUS`)만 쓰는데, 칠한 알약에 `outline-offset-2` 를 그대로 두면 「보라 알약 · 흰 틈 · 보라 선」이
 * 동심 테두리 두 겹으로 읽혔다(1440 실측). 그래서 이 버튼만 틈을 0 으로 붙이고, `Button` 의
 * `bg-clip-padding` + 투명 1px 테두리가 남기던 흰 실선도 `bg-clip-border` 와 포커스 때 테두리를 링과
 * 같은 색으로 칠해 없앤다 — 포커스는 알약 가장자리의 진보라 테 3px 하나로만 보인다(바깥 흰 바탕 대비 8.8:1).
 */
export function TopBar() {
  return (
    <header style={TV_VARS} className="sticky top-0 z-30 border-b border-[var(--tv-rule)] bg-white/90 backdrop-blur-md">
      <div className={`${CONTAINER} flex h-16 items-center gap-4`}>
        <Link
          href="/"
          className={`inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full ${FOCUS}`}
        >
          <Image
            src="/apple-touch-icon.png"
            alt=""
            width={32}
            height={32}
            className="rounded-full object-contain"
            priority
          />
          <span className="text-[18px] font-extrabold tracking-[-0.03em] text-[var(--tv-ink)]">
            {siteConfig.name}
          </span>
        </Link>

        <nav aria-label="페이지 안내" className="ml-3 hidden items-center gap-1 md:flex">
          {NAV.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className={`inline-flex h-11 items-center whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-[var(--tv-body)] transition-colors hover:text-[var(--tv-brand-deep)] ${FOCUS}`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center">
          <LandingCta
            label="시작하기"
            className={`h-11 border-transparent bg-[var(--tv-brand)] px-5 text-[14px] font-bold text-white bg-clip-border hover:bg-[var(--tv-brand-deep)] focus-visible:border-[var(--tv-brand-deep)] focus-visible:ring-0 lg:h-10 ${FOCUS} focus-visible:outline-offset-0`}
          />
        </div>
      </div>
    </header>
  );
}
