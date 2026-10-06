import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

import { ExampleStamp } from "./marks";
import { CONTAINER, FOCUS, STAGE_WRAP, TV_VARS, vars } from "./tokens";
import { NAV } from "./top-bar";

/**
 * 랜딩 푸터. `FooterGate` 가 `/` · 약관 · 개인정보 · 데스크톱 다운로드에서 범용 `Footer` 대신 세운다(옛 크림 ·
 * 갈색 파도 갈래는 옛 랜딩(사실 대조판)의 면이라 흰 바탕 · 보라 판 아래에서 다른 페이지처럼 읽혔고, APP-934 에서 걷었다).
 * 상단 바처럼 `.tv-root` 밖에 서서 `TV_VARS` 를 직접 건다.
 *
 * 히어로 무대와 같은 라벤더 판(같은 폭 `STAGE_WRAP` · 반경 28 · 40)이 흰 바탕에 떠 있다. 판 밖은 흰색이어야
 * 해서 바깥을 흰 바탕으로 감싼다(안 감싸면 루트의 `--el-canvas` 회색이 비친다).
 *
 * 판 안은 네 칸을 고르게 나눈다 — 소개 · 둘러보기 · 그 밖에 · 문의. 소개 칸만 넓고 링크를 오른쪽 끝에 몰았을 때는
 * 가운데가 비어 판이 휑했다. 테이프 · 말풍선 · 손글씨 같은 덧붙인 장식은 두지 않는다(붙인 것처럼 따로 놀았다).
 * 장식은 맨 아랫줄의 「예시」 도장 하나뿐이고, 그것도 지어낸 회의라는 고지의 일부다. 그 고지는 랜딩(`example`)
 * 에서만 그린다 — 약관 · 개인정보에는 지어낸 회의가 없고, 그 줄이 시행일까지 지어낸 날짜처럼 읽히게 했다.
 */
const LINK = cn(
  "inline-flex min-h-6 items-center rounded-[4px] text-[15px] text-[var(--tv-body)] underline-offset-[5px] transition-colors hover:text-[var(--tv-ink)] hover:underline hover:decoration-[var(--tv-pop)] hover:decoration-[3px]",
  FOCUS
);

const HEADING =
  "m-0 text-[13px] font-extrabold tracking-[0.02em] text-[var(--tv-muted)]";

const COLUMNS: Array<{ title: string; links: Array<[string, string]> }> = [
  { title: "둘러보기", links: NAV },
  {
    title: "그 밖에",
    links: [
      ["데스크톱 다운로드", "/download"],
      ["이용약관", "/terms"],
      ["개인정보 처리방침", "/privacy"],
    ],
  },
];

export function LandingFooter({ example = false }: { example?: boolean }) {
  return (
    <footer
      style={TV_VARS}
      className="bg-white pt-10 pb-5 font-sans text-[var(--tv-ink)] lg:pb-8"
    >
      <div className={cn(STAGE_WRAP, "px-3")}>
        <div className="rounded-[28px] bg-[var(--tv-lav)] lg:rounded-[40px]">
          <Reveal className={cn(CONTAINER, "pt-12 pb-8 lg:pt-14 lg:pb-10")}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-x-10">
              <div className="tv-r col-span-2 lg:col-span-1">
                <Link
                  href="/"
                  className={cn(
                    "inline-flex h-11 items-center gap-2.5 rounded-full",
                    FOCUS
                  )}
                >
                  <Image
                    src="/apple-touch-icon.png"
                    alt=""
                    width={36}
                    height={36}
                    className="rounded-full object-contain"
                  />
                  <span className="text-[22px] font-extrabold tracking-[-0.03em]">
                    {siteConfig.name}
                  </span>
                </Link>
                <p className="m-0 mt-3 max-w-[300px] text-[15px] leading-[1.7] text-balance break-keep text-[var(--tv-body)]">
                  회의를 받아 적고, 결정과 할 일을 근거와 함께 정리하는 AI
                  에이전트
                </p>
              </div>

              {COLUMNS.map((column, i) => (
                <nav
                  key={column.title}
                  aria-label={column.title}
                  className="tv-r"
                  style={vars({ "--i": i + 1 })}
                >
                  <h2 className={HEADING}>{column.title}</h2>
                  <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                    {column.links.map(([label, href]) => (
                      <li key={href}>
                        <Link href={href} className={LINK}>
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}

              <div
                className="tv-r col-span-2 lg:col-span-1"
                style={vars({ "--i": 3 })}
              >
                <h2 className={HEADING}>문의</h2>
                <p className="m-0 mt-3 text-[15px] leading-[1.7] break-keep text-[var(--tv-body)]">
                  궁금한 점이나 제안은 메일로 보내 주세요.
                </p>
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className={cn(
                    "mt-2 inline-flex min-h-6 items-center rounded-[4px] text-[15px] font-bold text-[var(--tv-brand-deep)] underline decoration-[var(--tv-pop)] decoration-[3px] underline-offset-[5px] hover:decoration-[var(--tv-brand)]",
                    FOCUS
                  )}
                >
                  {siteConfig.contactEmail}
                </a>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-2 border-t border-[var(--tv-rule-strong)] pt-5 text-[13px] leading-[1.6] break-keep text-[var(--tv-muted)] lg:mt-12 xl:flex-row xl:items-center xl:justify-between">
              {example ? (
                <p className="m-0 flex items-center gap-2.5">
                  <ExampleStamp />이 페이지의 회의, 인물, 날짜는 모두 지어낸
                  예시입니다.
                </p>
              ) : null}
              <p className="m-0">
                © 2026 {siteConfig.name}. All rights reserved.
              </p>
              <p className="m-0">
                AI 회의 에이전트는 사용자의 업무 효율을 높이는 보조 수단입니다.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </footer>
  );
}
