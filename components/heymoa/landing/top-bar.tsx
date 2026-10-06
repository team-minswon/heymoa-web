import Image from "next/image";
import Link from "next/link";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { siteConfig } from "@/lib/site";

import { CONTAINER, FOCUS, TV_VARS } from "./tokens";

/**
 * 구간 다섯으로 가는 메뉴. 푸터 「둘러보기」도 이것을 쓴다. 이름은 구간이 보여 주는 것(회의 정리 · 근거
 * 확인 · 프로젝트 · 내 에이전트 · 도구 연결)이다 — 전의 「회의별로 · 그 말 확인 · 팀 · 물어보기 · 다른 도구로」는
 * 구간 제목에서 낱말을 떼어 와 메뉴만 보고는 무엇이 있는지 읽히지 않았다.
 * href 는 `/#…` 다 — 약관 · 개인정보 페이지도 이 바를 써서, `#…` 만 두면 그 페이지 안에서 헛돈다.
 */
export const NAV: Array<[string, string]> = [
  ["회의 정리", "/#meetings"],
  ["근거 확인", "/#evidence"],
  ["프로젝트", "/#team"],
  ["내 에이전트", "/#ask"],
  ["도구 연결", "/#safety"],
];

/**
 * 상단 바. `<main>` 밖(`NavbarGate`)에 서서 `.tv-root` 의 변수를 못 받으니 `TV_VARS` 를 직접 건다.
 * tl;dv 의 흰 가로 바를 따랐고, 앱 Navbar 의 떠 있는 알약은 쓰지 않았다.
 * 로고는 Navbar 와 같은 자산(`/apple-touch-icon.png`)이다. md 미만은 로고 + 시작하기만 남는다.
 * 768 에서 메뉴 다섯이 한 줄에 든다 — 셈은 넓은 쪽 버튼(로그인한 사람의 「대시보드로 이동」 약 144)으로 한다:
 * 로고 108 + 메뉴 약 384(글자 288 · Apple SD Gothic Neo 15px 실측 + 좌우 여백 80(md 는 px-2) + 간격 16) +
 * 버튼 144 + 틈 44 ≈ 680 / 728. 남는 48 은 한글 폭이 1em 인 Noto Sans CJK · 맑은 고딕(+20~40)을 받는 몫이다.
 * lg 부터는 폭이 넉넉해 여백을 px-3 으로 되돌린다.
 * 「설치 없음」 말풍선은 두지 않는다 — 랜딩에서 「설치할 것 없음 · 신용카드 없음」 류 문구는 뺐고(72f4c27),
 * 어디서 쓰는지(웹 · 데스크톱 베타)는 FAQ 01 하나에만 둔다.
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
          {/* `Link` 다 — 약관 · 개인정보에서 누르면 `/` 로 넘어가는데, 일반 `<a>` 면 문서를 통째로 다시 받아
              녹음 중이던 회의가 끊긴다(녹음은 route 를 넘어 살아야 한다 — 옛 Navbar 의 `router.push` 와 같은 이유). */}
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex h-11 items-center whitespace-nowrap rounded-full px-2 text-[15px] lg:px-3 font-semibold text-[var(--tv-body)] transition-colors hover:text-[var(--tv-brand-deep)] ${FOCUS}`}
            >
              {label}
            </Link>
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
