"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

import {
  CHOICE,
  ChoiceCheck,
  ConfirmBar,
  DecisionRow,
  FacesChip,
  HeadChip,
  ReplacementRow,
  ReviewHead,
  SectionHead,
  TaskRow,
} from "./app";
import { useOnceInView, useReducedMotion } from "./hooks";
import { Cursor, Hand, Scribble, Sticky } from "./marks";
import { APP, FOCUS, vars } from "./tokens";

/*
 * 주간 회의 카드의 창 몸통 — 이 구간에서 유일하게 움직이고 눌리는 자리다. 머리(페이지)는
 * `meeting-cards.tsx` 의 `MeetingCard` 가 그리고, 이 파일은 그 안에 들어가는 요약 탭 몸통 · 확정 막대 ·
 * 카드 바닥에 매달린 쪽지를 한꺼번에 그린다(쪽지 문구가 고른 값을 따라가서).
 *
 * 앱의 흐름 그대로다: 새 결정이 지난주에 확정한 결정을 뒤집어 보이면 「이전 결정 대체」 제안이 줄 아래
 * 서고(`suggestion-row.tsx` `ReplacementSuggestion`), 「끝내기 / 유지」를 고르기 전에는 확정 막대가
 * 주황 「확인할 제안 1개」에 「검토 완료」가 흐리다(`confirm-bar.tsx`, 랜딩에서는 읽히게 덜 흐리게 — 아래 막대). 고르면 막대가 「결정 1개와 할 일
 * 1개를 프로젝트에 올립니다」로, 끝내기면 「· 이전 결정 1개 끝남」까지 붙는다.
 *
 * 스크롤로 막대가 들어오면 한 번 재생한다: 2초 머문 뒤 커서가 「끝내기」로 와서 누르고 → 토글이 초록
 * 체크로 → 0.4초 뒤 막대 문구와 숫자가 바뀐다. 머무는 2초는 「고르기 전엔…」 쪽지(두 줄)가 3초 넘게 읽히게 하는
 * 몫이다(지난 판은 1.7초 만에 「골랐으니…」로 바뀌었다). 방문자가 먼저 누르면 재생을 거둔다. 모션을 줄이면
 * 커서 없이 곧바로 끝내기를 고른 모습이고, 서버 HTML · JS 없음은 아직 안 고른 모습(그것도 앱의 참 상태)이다.
 *
 * 확정 막대는 카드 폭에 맞춘 잘라 보이기다(`app.tsx` `BAR`). 앱 그대로의 `float` 는 카드(330) 폭을 거의 다
 * 채워 카드 안쪽 20px 에 둥근 선 · 그림자가 한 겹 더 서는 동심 테두리였다. 그래서 가운데 좁은 `pill`(264 이하,
 * 카드 양옆에서 약 33px) — 앱의 막대도 넓은 창 가운데 놓인 좁은 막대라(요약 탭 실측: 창 약 1030 중 약 320)
 * 「창보다 좁게 떠 있는 흰 막대」라는 성격이 같다. 카드가 300 안팎으로 좁아지는 폭(380 미만 화면, 1024~1099)
 * 에서는 알약도 카드 양옆 16~20px 까지 붙어 다시 동심이 되니 선 · 그림자 없는 회색 `plate` 로 바꾼다.
 * 검토관 안이던 「카드 바닥에 반쯤 걸치기」는 막대 폭이 카드와 거의 같아 바닥에 같은 폭 둥근 상자 둘이 포개
 * 보이고, `dock` 은 같은 페이지에서 떠 있는 막대(히어로 · 근거 구간)와 모양이 갈려 택하지 않았다.
 * 바로 위 할 일 줄의 아래 선은 `.tv-row` 규칙(`motion.tsx`, 뒤에 줄이 없으면 선을 지운다)이 지운다.
 */

type Choice = "change" | "keep";

const OPTIONS: ReadonlyArray<readonly [Choice, string]> = [
  ["change", "끝내기"],
  ["keep", "유지"],
];

/**
 * 재생 박자(ms). 1 커서가 미끄러져 옴 → 2 누름(노란 고리는 `Cursor` 가 450ms 뒤에 퍼뜨린다 = 2600) →
 * 3 토글 → 4 막대(여기서 쪽지가 「골랐으니…」로 바뀐다 — 「고르기 전엔…」이 3초 머문 뒤) → 5 커서가 걷힘.
 */
const BEATS = [2000, 2150, 2600, 3000, 5400] as const;

/**
 * 막대 모양을 폭으로 가른다(위 머리 주석). 두 벌을 그리고 CSS 로 하나만 보인다 — 범위가 서로 겹치지 않는다.
 * 카드 폭: 좁은 화면 = 화면 − 56(최대 360), 넓은 화면 = (기둥 − 48) / 3 이라 1024 에서 299, 1100 에서 324.
 */
const BAR_AT = {
  pill: "hidden min-[380px]:max-lg:flex min-[1100px]:flex",
  plate: "hidden max-[380px]:flex lg:max-[1100px]:flex",
} as const;

const ARROW_STEP: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export function WeeklyWindow() {
  const [picked, setPicked] = useState<Choice | null>(null);
  const [beat, setBeat] = useState(0);
  const [attach, seen] = useOnceInView<HTMLDivElement>({ threshold: 0.9 });
  const reduced = useReducedMotion();
  const radios = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!seen || reduced || picked) return;
    const timers = BEATS.map((at, i) => window.setTimeout(() => setBeat(i + 1), at));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [seen, reduced, picked]);

  const toggle = picked ?? (reduced || beat >= 3 ? "change" : null);
  const bar = picked ?? (reduced || beat >= 4 ? "change" : null);
  const cursor = !picked && !reduced && beat >= 1 && beat < 5;

  /**
   * APG 라디오 그룹: 탭 정류장은 하나(고른 것, 아무것도 안 골랐으면 첫 칸)이고, 방향키가 고름과 포커스를
   * 함께 옮긴다(끝에서 처음으로 돈다). 방향키가 넘김 상자까지 번져 카드가 옆으로 밀리지 않게 막는다.
   */
  const onRadioKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = ARROW_STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    setPicked(OPTIONS[next][0]);
    radios.current[next]?.focus();
  };
  const stop = toggle ?? OPTIONS[0][0];

  return (
    <>
      <div className="relative px-4 pt-4 pb-5 sm:px-5">
        <ReviewHead
          state="검토 중"
          title="디자인팀 주간 회의"
          chips={
            <>
              <HeadChip icon="date">8월 31일 (월) 오전 11:00</HeadChip>
              <HeadChip icon="length">28분</HeadChip>
              <FacesChip names={["윤하린", "문지호", "송다온"]} />
              <HeadChip icon="project">배너 개편</HeadChip>
            </>
          }
        />

        <div className="mt-6">
          <SectionHead title="결정" count={1} />
          <div className={cn("mt-2 border-t", APP.lineSoft)}>
            <DecisionRow
              text="배포는 다음 주 화요일로 미룬다"
              at="09:32"
              suggestions={
                <ReplacementRow
                  className="relative"
                  target="새 배너는 9월 4일 금요일에 배포한다"
                  meta="배너 시안 리뷰 · 8월 27일 확정"
                  reason="배포일을 금요일에서 다음 주 화요일로 옮기는 결정이라 이전 결정과 맞지 않습니다."
                  toggle={
                    <>
                      {/*
                        `choice-toggle.tsx` 와 같은 모양 · 같은 이름의 진짜 라디오다. 다른 점 둘: 보이는 높이
                        22px 는 그대로 두고 투명한 누름 칸을 위아래로 11px 씩 넓혀 44px 로 만들었고(엄지
                        자리), 안 고른 쪽 글자를 앱의 muted(바탕 위 4.2:1) 대신 body(7:1)로 한 단 짙게 했다.
                      */}
                      <span role="radiogroup" aria-label="이전 결정을 끝낼지" className={CHOICE.group}>
                        {OPTIONS.map(([value, label], index) => {
                          const on = toggle === value;
                          return (
                            <button
                              key={value}
                              ref={(el) => {
                                radios.current[index] = el;
                              }}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              tabIndex={value === stop ? 0 : -1}
                              onClick={() => setPicked(value)}
                              onKeyDown={(event) => onRadioKey(event, index)}
                              className={cn(
                                CHOICE.option,
                                "relative cursor-pointer transition-colors before:absolute before:inset-x-0 before:-inset-y-[11px] before:content-['']",
                                on
                                  ? value === "change"
                                    ? CHOICE.changeOn
                                    : CHOICE.keepOn
                                  : "text-[var(--el-body)] hover:text-[var(--el-ink)]",
                                FOCUS
                              )}
                            >
                              {on && value === "change" ? <ChoiceCheck /> : null}
                              {label}
                              {value === "change" && cursor ? (
                                <Cursor press={beat >= 2} className="top-[40%] left-[45%]" />
                              ) : null}
                            </button>
                          );
                        })}
                      </span>
                      {/* 카드 오른쪽 바깥 여백이 넉넉한 넓이에서만 선다(세 번째 칸이라 오른쪽이 페이지 여백이다). */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-[44px] left-full ml-7 hidden w-max flex-col xl:flex"
                      >
                        <Scribble kind="arrow" flipX draw="reveal" delay={900} className="h-6 w-10" />
                        {/*
                          머리 농담(「말 바뀌는 날」)을 되풀이하지 않고 날짜를 짚는다 — 8월 27일 확정(위 meta) →
                          8월 31일 회의. 세 줄로 끊어 1280 폭의 오른쪽 여백(약 110px) 안에 든다.
                        */}
                        <Hand className="-mt-0.5 text-[13px]">
                          8월 27일에
                          <br />
                          정한 걸
                          <br />
                          나흘 만에
                        </Hand>
                      </span>
                    </>
                  }
                />
              }
            />
          </div>
        </div>

        <div className="mt-7">
          <SectionHead title="할 일" count={1} />
          <div className={cn("mt-2 border-t", APP.lineSoft)}>
            <TaskRow
              text="QA 요청 메일을 오늘 안에 보낸다"
              who={{ name: "윤하린" }}
              due="8월 31일 (월)"
            />
          </div>
        </div>
      </div>

      {/*
        막대가 다 보여야 재생한다 — 위의 토글은 그보다 먼저 화면에 있다.
        모양은 머리 주석대로 폭에 따라 `pill`(가운데 좁은 알약) 또는 `plate`(선 없는 회색 판)다. 알약 아래
        여백(28px)도 양옆(약 33px)처럼 카드 바닥과 24px 넘게 떼어 바닥선과 나란한 둥근 선이 붙어 보이지 않게 한다.
        `plate` 는 카드 폭에서 꺾여(flex-wrap, 「검토 완료」는 다음 줄 오른쪽) 세로선이 홀로 남으니 빼고, 문구를
        두 줄로 고르게 나눈다(text-wrap: balance). `pill` 에는 세로선이 없다.
      */}
      <div ref={attach} className="px-4 pb-7 sm:px-5">
        {(["pill", "plate"] as const).map((variant) => (
          <ConfirmBar
            key={variant}
            variant={variant}
            state={
              bar === null
                ? { kind: "unchosen", n: 1 }
                : { kind: "ready", decisions: 1, tasks: 1, ended: bar === "change" ? 1 : undefined }
            }
            buttonSlot={
              bar === null ? null : (
                <span
                  key={bar}
                  aria-hidden
                  className="tv-ring pointer-events-none absolute inset-0 rounded-[inherit]"
                  style={vars({ "--n": 2 })}
                />
              )
            }
            className={cn(
              BAR_AT[variant],
              "[&>[aria-hidden]]:hidden [&>span:first-child]:text-balance",
              // 흐린 「검토 완료」(마지막 자식)를 앱의 50% 대신 65% 로 — 흰 글자 대비 3.1 → 4.8:1(흰 판 · 회색 판 모두).
              // 쪽지 「고르기 전엔 검토 완료가 안 눌려요」가 가리키는 글자라 읽혀야 한다. 흐린 모양 자체는 앱과 같다.
              bar === null && "[&>span:last-child]:opacity-65"
            )}
          />
        ))}
      </div>

      <Sticky
        key={bar === null ? "before" : "after"}
        tone="pop"
        size="sm"
        tilt={-3}
        anim={bar === null ? "reveal" : "pop"}
        delay={bar === null ? 900 : 0}
        className="absolute right-3 -bottom-12 z-10 lg:-right-6"
      >
        {bar === null ? (
          <>
            고르기 전엔
            <br />
            검토 완료가 안 눌려요
          </>
        ) : (
          <>
            골랐으니
            <br />
            이제 눌러도 돼요
          </>
        )}
      </Sticky>
    </>
  );
}

/* ── 회의 카드 넘김 상자 ──────────────────────────────────────────────────── */

const WIDE = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * 회의 카드 세 장을 담는 상자(`meeting-cards.tsx` 는 서버 컴포넌트라 이 작은 조각만 여기 둔다).
 * 좁은 화면에서는 가로로 넘기는 상자라 포커스를 받아 방향키로 넘어가고(`role="region"` + 이름 +
 * `tabIndex 0`), 넓은 화면(lg, 1024px~)에서는 넘길 것이 없는 격자라 그 셋을 거둔다 — 하는 일 없는 탭
 * 정류장이 생기지 않게. 서버 HTML 과 첫 하이드레이션은 좁은 화면 쪽이고, 붙은 뒤 실제 폭을 따른다.
 */
export function CardRail({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false
  );
  return (
    <div
      role={wide ? undefined : "region"}
      aria-label={wide ? undefined : label}
      tabIndex={wide ? undefined : 0}
      className={className}
    >
      {children}
    </div>
  );
}
