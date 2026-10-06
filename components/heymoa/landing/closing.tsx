import { LandingCta } from "@/components/heymoa/landing-cta";
import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import { Face } from "./app";
import { ExampleStamp, Scribble, Speech } from "./marks";
import { CLOSING_H, CONTAINER, FOCUS_ON_BRAND, RADIUS, SHADOW, vars } from "./tokens";

/**
 * 마무리. tl;dv 처럼 보라 색 면 하나로 닫는다. 히어로가 던진 「이번 주 회의록 당번 누구예요?」를
 * **당번표 종이**로 받는다 — 블록 오른쪽 위 모서리에 테이프로 붙은 종이에서 이름 넷이 차례로 그어지고,
 * 아래에 「받아 적기 — HeyMoa / 검토 완료 — 나」가 남는다. 왼쪽 아래 모서리에는 히어로에서 「저… 지난주에
 * 했는데요」 하던 박지훈이 「저 이번 주는 쉬어도 되죠?」 하고 묻는다(넓은 화면만) — 히어로의 농담 · 제목
 * 「쉬어도 됩니다」와 수미상관이고, 종이의 「검토 완료 — 나」가 답이다. 전에 붙였던 쪽지 「방금 나온 할 일」
 * · 「눌러야 확정」은 앞 구간 말을 떼어 온 조각이라 여기서는 무엇을 가리키는지 안 읽혀서 뺐다.
 *
 * - 종이 · 말풍선은 장식이라 `aria-hidden` 이다. 농담의 뜻(받아 적기는 HeyMoa 몫)은 본문 글자가 따로
 *   말한다. 종이의 이름은 지어낸 사람이라 「예시」 도장을 붙였다(말풍선 얼굴은 그 종이의 2주 박지훈).
 * - 흰 종이가 블록 위로 흰 바탕에 걸치므로 쪽지 키트의 흰 쪽지(`Sticky tone="white"`)처럼 먹색
 *   1.5px 테를 두른다 — 테가 없으면 걸친 윗부분이 바탕에 녹아 종이 모양이 사라진다.
 * - 「당번표」는 붙여 쓴다(종이 제목 「회의록 당번표」와 같게).
 * - 제목은 두 줄로 고정한다(「다음 회의에는 / 당번표를 접어 두세요」). 1440 에서 한 줄로 두면 오른쪽 끝
 *   「두세요」가 종이 밑으로 들어간다. 두 줄이면 둘째 줄 끝과 종이 사이가 1440 에서 약 80px, 1024 에서
 *   약 34px 남는다(붙여 쓰며 반 칸쯤 넓어졌다). 좁은 화면(<768)은 종이와 제목이 같은 세로 띠에 서서
 *   블록 위 여백(pt-32)으로 종이 아래에 제목을 내린다.
 * - 본문은 「훑어보고 검토 완료」를 되풀이하지 않는다 — 히어로 · 근거 · FAQ 가 이미 여러 번 했고, 종이의
 *   「검토 완료 — 나」가 그 몫을 그림으로 말한다. 대신 당번 농담을 닫는다: 이번 주 당번 칸에 HeyMoa를
 *   적으라고 하고(종이의 「받아 적기 — HeyMoa」를 본문이 되풀이하지 않게 「받아 적기」 낱말은 피한다), 히어로의
 *   「지난주에 했는데요」를 받아 「누가 했는지 따질 일도 없다」. 사람이 검토해야 확정된다는 말과 어긋나는 「아무것도 안 해도 된다」류는 쓰지 않는다.
 * - 움직임은 조상 `Reveal` 이 화면에 들어올 때 한 번: 종이가 비스듬히 들어오고(0ms) → 「당번표를」
 *   고리(400ms) → 이름 긋기(600 · 750 · 900 · 1050ms) → 손글씨 두 줄(1450 · 1650ms) → 박지훈 말풍선
 *   (1900ms). 모션을 줄이면 처음부터 다 그어진 끝 상태다.
 */

const ROSTER = [
  ["1주", "김민서"],
  ["2주", "박지훈"],
  ["3주", "이서연"],
  ["4주", "정우재"],
] as const;

const SCRAWL =
  "tv-rpop m-0 origin-left whitespace-nowrap text-[13px] leading-[1.35] font-extrabold tracking-[-0.01em] text-[var(--tv-brand-deep)] lg:text-[14px]";

/**
 * 회의록 당번표 — 흰 종이 + 먹색 테 + 노란 테이프 + 오른쪽 아래 접힌 귀(라벤더 삼각형과 먹색 접은 선).
 * 기울기는 `rotate` 속성이라 등장(`tv-rslide` 의 translate)과 겹치지 않는다. 모바일은 셋째 · 넷째 주를
 * 빼서 제목과 겹치지 않게 키를 줄인다.
 */
function DutyRoster() {
  return (
    <div
      aria-hidden
      className="tv-rslide absolute -top-10 right-3 w-[170px] lg:-top-12 lg:-right-6 lg:w-[232px]"
      style={{ rotate: "6deg", ...vars({ "--d": "0ms" }) }}
    >
      <div
        className={`relative rounded-[6px] border-[1.5px] border-[var(--tv-ink)] bg-[linear-gradient(315deg,var(--tv-lav)_0_15px,var(--tv-ink)_15px_16.5px,white_16.5px)] p-3 text-left lg:p-4 ${SHADOW.sticky}`}
      >
        <span className="absolute -top-3 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-[4deg] bg-[var(--tv-pop)]/70" />

        <div className="flex items-center justify-between gap-2 border-b border-[var(--tv-rule)] pb-1.5 lg:pb-2">
          <span className="text-[13.5px] leading-[1.3] font-extrabold whitespace-nowrap text-[var(--tv-ink)] lg:text-[15px]">
            회의록 당번표
          </span>
          <ExampleStamp className="h-5 px-1.5 text-[11px]" />
        </div>

        <ul className="m-0 mt-1 list-none p-0 lg:mt-1.5">
          {ROSTER.map(([week, who], i) => (
            <li
              key={who}
              className={cn(
                "flex items-center gap-2 py-1 text-[13px] leading-[1.3] font-bold text-[var(--tv-body)] lg:text-[14px]",
                i > 1 && "hidden lg:flex"
              )}
            >
              <span className="w-6 shrink-0 text-[var(--tv-muted)] tabular-nums">{week}</span>
              <Face who={who} size={18} className="shrink-0" />
              <span className="relative whitespace-nowrap">
                {who}
                <Scribble
                  kind="strike"
                  color="ink"
                  draw="reveal"
                  delay={600 + i * 150}
                  className="absolute top-1/2 -left-1 h-[10px] w-[calc(100%+8px)] -translate-y-1/2"
                />
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-1.5 border-t border-dashed border-[var(--tv-rule-strong)] pt-1.5 lg:mt-2 lg:pt-2">
          <p className={SCRAWL} style={vars({ "--d": "1450ms" })}>
            받아 적기 — HeyMoa
          </p>
          <p className={SCRAWL} style={vars({ "--d": "1650ms" })}>
            검토 완료 — 나
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 「당번표를」 둘레의 노란 고리. `Scribble` 의 동그라미는 타원이라 굵은 글자 네 귀를 긋고 지나가서,
 * 네모에 가까운 손 고리를 여기 둔다(끝이 윗변을 반쯤 다시 지나는 손맛은 같다). 늘어나는 상자에 맞춰
 * 그리고(`preserveAspectRatio="none"`), 윗변이 두 줄 사이 틈 한가운데를 지나게 자리를 맞췄다.
 * 그리기는 `Scribble` 과 같은 `tv-rdraw` 라 모션을 줄이면 처음부터 다 그려져 있다.
 */
function Loop() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute -top-[5px] -left-[10px] h-[calc(100%+10px)] w-[calc(100%+20px)] overflow-visible text-[var(--tv-pop)] [stroke-width:5] lg:-top-[6px] lg:-left-[18px] lg:h-[calc(100%+12px)] lg:w-[calc(100%+36px)] lg:[stroke-width:4]"
    >
      <path
        d="M26 7 C70 3, 140 2, 182 6 C196 8, 198 48, 184 53 C140 58, 62 58, 18 54 C4 52, 2 13, 16 8 C34 3, 66 3, 100 5"
        pathLength={1}
        className="tv-rdraw"
        // 간격을 길이보다 길게(1 2) 준다. `tv-rdraw` 의 `1`(=1 1)이면 숨은 상태에서 길이 0 짜리 다음
        // 마디가 끝점에 걸려 둥근 끝이 노란 점으로 남는다. 인라인이라 모션을 줄여도 다 그려진 채다.
        style={{ strokeDasharray: "1 2", ...vars({ "--d": "400ms" }) }}
      />
    </svg>
  );
}

export function Closing() {
  return (
    <section className="bg-white pt-16 pb-16 lg:pt-28 lg:pb-24">
      <div className={CONTAINER}>
        <Reveal
          className={`relative ${RADIUS.face} bg-[var(--tv-brand)] px-6 pt-32 pb-14 text-center md:pt-20 lg:px-16 lg:py-20`}
        >
          <DutyRoster />

          {/* 블록 아래 모서리에 걸친다 — 흰 말풍선(먹색 테)이라 흰 바탕으로 넘어가도 모양이 남는다.
              CTA 아래 여백(lg:pb-20)보다 얕게 걸쳐 버튼과 겹치지 않는다. */}
          <div aria-hidden className="absolute -bottom-5 -left-5 hidden whitespace-nowrap lg:block">
            <Speech who="박지훈" tone="white" tilt={-4} anim="reveal" delay={1900}>
              저 이번 주는 쉬어도 되죠?
            </Speech>
          </div>

          <div className="flex flex-col items-center">
            <h2 className={cn(CLOSING_H, "mx-auto max-w-[780px] leading-[1.3] lg:leading-[1.2]")}>
              다음 회의에는 <br />
              <span className="relative mr-1.5 whitespace-nowrap lg:mr-2">
                당번표를
                <Loop />
              </span>{" "}
              접어 두세요
            </h2>
            <p className="m-0 mt-5 max-w-[520px] text-balance break-keep text-[16px] leading-[1.75] text-[var(--tv-on-brand)] lg:text-[18px]">
              이번 주 당번 칸에는 HeyMoa를 적어 두세요. <br className="hidden lg:inline" />
              지난주에 누가 했는지 따질 일도 없고요.
            </p>
            {/* 모든 폭에서 글자 폭만큼의 알약이다. 전에는 모바일에서 꽉 채워(w-full) 보라 블록 양옆과
                24px 간격으로 평행한 노란 띠가 됐고, 둥근 블록 안의 둥근 띠가 테두리 두 겹으로 읽혔다.
                모바일은 히어로 CTA 와 같은 15px · px-6 으로 줄여 320 에서도 양옆이 30px 넘게 빈다. */}
            <LandingCta
              label="Google 계정으로 시작"
              className={`mt-8 h-[56px] justify-center gap-2 border-transparent bg-[var(--tv-pop)] px-6 text-[15px] font-extrabold text-[var(--tv-ink)] hover:bg-white focus-visible:border-transparent focus-visible:ring-0 lg:mt-10 lg:px-8 lg:text-[16px] ${FOCUS_ON_BRAND}`}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
