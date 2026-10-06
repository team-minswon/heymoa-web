"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type DependencyList,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Copy,
  LoaderCircle,
  Mic,
  MoreHorizontal,
  SkipForward,
  Square,
  UserPlus,
  Users,
} from "lucide-react";

import {
  BASE_ENTRIES,
  BASE_LINES,
  FILTER_OF,
  FILTERS,
  LENGTH,
  NOTE_TABS,
  PROJECT,
  SPEAKER_LABEL,
  TIMELINE,
  TITLE,
  TRANSCRIPT,
  type Demo,
  type Entry,
  type NoteTab,
} from "@/components/heymoa/landing/use-demo";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import type { TimelineTone } from "@/lib/notes/proposals/timeline";
import { cn } from "@/lib/utils";

import {
  ConfirmBar,
  DecisionRow,
  EvidenceQuotes,
  Face,
  FacePile,
  FacesChip,
  HeadChip,
  LiveChip,
  ReviewHead,
  SectionHead,
  SpeakerFace,
  StatusChip,
  TaskRow,
  TimelineRow,
} from "./app";
import { DOC, type Scene } from "./hero-data";
import { Cursor, Scribble, Sticky } from "./marks";
import { APP, FOCUS, ROLE_COLOR, vars } from "./tokens";

/*
 * 히어로의 노트 창 안쪽. **앱 화면 그대로다** — `note-panel.tsx`(상단바) · `transcript-view.tsx` ·
 * `note-timeline.tsx` · `review/*`(요약 탭) · `recording-dock.tsx` · `note-details.tsx` 의 구조와 값을
 * 옮겼다. 기존 랜딩의 `product-shot.tsx` 가 같은 화면을 0.85배로 그린 것을 앱 원래 크기로 다시 썼다.
 *
 * 창 안 = `--el-*` · `APP` · 앱 역할 색만. 페이지의 색(`--tv-*`)은 창 위에 얹는 주석에만 나온다 —
 * 방금 붙은 줄의 섬광, 커서, 노란 고리, 「>>>」 빨리 감기 쪽지, 칩 둘레의 손그림 동그라미, 레일 머리의 형광펜.
 * 기울었거나 반투명이거나 금방 사라져서 앱 UI 로 오인되지 않는다.
 *
 * **앱이 `--el-muted-soft`(흰 바탕 2.5:1)로 쓰는 정보 글자는 `APP.muted`(4.8:1)로 올린다** — 시각 · 개수 ·
 * 범위 · 단계 이름 · 상태 줄(`app.tsx` 와 같은 규칙). 「몇 분에 누가 한 말인지」가 이 페이지가 파는 정보라
 * 그림이라도 읽혀야 한다. `APP.faint` 는 점 · 아이콘 · 셰브런에만 남는다 — 예외는 없다. 회색 칩 면
 * (`--el-surface-strong` #f0efed) 위에서는 `APP.muted` 도 4.2:1 이라 한 단 짙은 `APP.body` 를 쓴다(「전체」 칩의
 * 개수, 「요약 / 그래프」 전환의 「그래프」).
 *
 * 진짜로 눌리는 것: 탭 넷(방향키 · roving tabIndex), 탭 본문(스크롤 상자 = tabpanel, 키보드로 굴린다),
 * 안건 접기. 나머지(회의 종료 · 독 · 복사 · 검토 완료)는 그림이라 `<span>` 이다 — 눌러도 할 일이 없는
 * 것을 버튼으로 두면 탭 순회에 빈 정거장만 는다.
 *
 * 잘라 보이기: 상단바의 ← · ⤡ 와 펼친 결정의 「수정 · 제외」는 뺐다(앱보다 줄이는 것만 한다). 앞의 것은
 * 중지된 뒤 「⋯」가 붙을 때 제목이 「3차 스프린트 …」로 잘리던 자리를 비우고, 뒤의 것은 마지막 장면에서
 * 근거 상자와 할 일이 한 창에 같이 들게 한다.
 */

/* ── 스크롤 ─────────────────────────────────────────────────────────── */

/** `node` 의 위치를 스크롤 상자 `box` 안에서 잰다. 등장 애니메이션(transform)에 안 흔들리게 offset 으로 잰다. */
function topIn(node: HTMLElement, box: HTMLElement) {
  let y = 0;
  let at: Element | null = node;
  while (at instanceof HTMLElement && at !== box) {
    y += at.offsetTop;
    at = at.offsetParent;
  }
  return y;
}

/**
 * 바닥을 따라가는 자리를 **줄의 경계로 내려 맞춘다.** 그냥 바닥을 따라가면 창 맨 위가 글자 한가운데서
 * 잘려(메타 칩 · 첫 발화의 윗절반) 렌더링이 깨진 것처럼 보였다. 바닥 아래에 `--reserve`(독 자리)를 남긴
 * 위치(`want`)를 구하고, 그보다 아래에서 시작하는 첫 줄(`[data-snap]` · 타임라인의 `ol > li`)의 머리가 창
 * 맨 위(`[data-snap-head]` 가 있으면 그 바로 밑)에 오게 한다. **아래로만** 맞추므로 맨 아래 줄은 늘
 * `--reserve` 위, 독 밖에 선다.
 *
 * 예외 — **좁은 화면은 한 행 넘게 비우지 않는다.** 아래로 맞추면 맨 아래 줄 밑이 최대 한 행만큼 더 빈다.
 * 390 에서는 말 한 줄이 두세 줄로 꺾여 행이 100px 를 넘고, 그러면 받아 적는 줄 하나만 창 위쪽에 떠 있고
 * 독까지 80px 가 비어 「앞의 말이 쌓인다」가 안 읽혔다(앱 `transcript-view.tsx` 는 바닥을 따라가 앞 줄이
 * 받아 적는 줄 위에 쌓인다). 그래서 sticky 머리가 덮는 탭(스크립트)은 경계가 `want` 보다 `SNAP_SLACK` 넘게
 * 아래면 맞추지 않고 `want` 에 선다 — 앞 줄의 꼬리가 「복사」 머리 밑으로 들어가며 보인다. 그 탭의 창 맨
 * 위는 그래서 늘 줄의 머리는 아니다. 그 꼬리가 시각 없이 「복사」 밑에 홀로 서서 잘린 그림처럼 읽혔으므로
 * (390 「맡겠습니다. 이번 주 목요일까지 초안 올릴게요.」), 그렇게 꼬리에서 멈출 때만(`data-cut`) 머리 밑
 * 흐림을 16 → 36px 로 키워 꼬리의 첫 줄을 거의 지운다 — 「위로 지나간 말」로 읽힌다(`ScriptPanel`). 줄
 * 머리에 맞춘 때는 16 그대로다(36 이면 맞춘 줄의 첫 줄까지 흐려진다). 줄 머리로 **올려** 맞추면 받아 적는
 * 줄이 독 밑으로 들어가고, 내려 맞추면 독 위가 한 행 빈다 — 그래서 흐림으로 푼다. 머리가 없는 탭(타임라인)은
 * 행이 짧아 그대로 줄 머리에 맞춘다. 닿는 경계가 스크롤 끝보다 아래면 역시 `want` 다.
 * 지킬 것: **모바일에서도 받아 적는 줄 위에 앞의 말이 적어도 한 줄은 보인다.**
 *
 * 읽으려고 위로 올린 사람은 끌어내리지 않는다(`hooks.ts` `useFollowBottom` 과 같은 약속). 단, 줄이 빠져
 * 내용이 짧아지면 브라우저가 스크롤을 끝으로 끌어올리는데, 그 스크롤 이벤트를 「사람이 올렸다」로 읽으면
 * 따라가기가 풀려 줄 한가운데서 멈췄다(모바일 타임라인, 중지 직후) — 끝에 붙어 있으면 따라가는 중으로 친다.
 * `scrollTop` 만 쓴다 — 숨은 쪽이 페이지를 끌고 가지 않게.
 */
function useSnapFollow(deps: DependencyList) {
  const ref = useRef<HTMLDivElement>(null);
  const placed = useRef(0);
  const following = useRef(true);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    following.current =
      el.scrollTop >= placed.current - 24 || el.scrollTop >= el.scrollHeight - el.clientHeight - 2;
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || !following.current) return;
    const style = getComputedStyle(el);
    const max = el.scrollHeight - el.clientHeight;
    const end = el.scrollHeight - (parseFloat(style.paddingBottom) || 0);
    const want = end + (parseFloat(style.getPropertyValue("--reserve")) || 0) - el.clientHeight;
    let top = 0;
    /** 창 맨 위가 줄 머리가 아니라 앞 줄의 꼬리인가 — 그때만 머리 밑 흐림을 키운다(`data-cut`). */
    let cut = false;
    if (max > 0 && want > 0) {
      const head = el.querySelector<HTMLElement>("[data-snap-head]");
      // 머리가 있으면 그 바로 밑, 없으면 위쪽 흐림(20px) 안에 12px 을 둔다.
      const gap = head ? head.offsetHeight : 12;
      const slack = head ? SNAP_SLACK : Infinity;
      top = Math.min(want, max);
      cut = head !== null;
      for (const node of el.querySelectorAll<HTMLElement>("[data-snap], ol > li")) {
        // 접힌 안건 · 좁은 화면에서 숨긴 머리는 offsetParent 가 없다.
        if (!node.offsetParent) continue;
        const at = topIn(node, el) - gap;
        if (at < want) continue;
        if (at <= max && at - want <= slack) {
          top = at;
          cut = false;
        }
        break;
      }
    }
    placed.current = top;
    el.scrollTop = top;
    el.toggleAttribute("data-cut", cut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [ref, onScroll] as const;
}

/**
 * 따라가는 탭(스크립트 · 타임라인)의 바닥 자리(`--reserve`) — 독이 차지하는 높이에 틈을 더한 것. 좁은 화면은
 * 아래 여백 12 + 독 40 + 틈 8 = 60, 넓은 화면은 16 + 44 + 16 = 76. 맨 아래 줄(받아 적는 줄)이 늘 독 위에
 * 선다. 좁은 화면 틈을 줄인 16px 만큼 받아 적는 줄 위에 앞 줄이 더 든다. 예전에는 넓은 화면에서 쪽지 몫까지
 * 112px 를 비워 그 빈 띠에 쪽지를 세웠는데, 쪽지는 창 밖 거터로 나갔다(`hero-stage.tsx`, 화면 규칙 7).
 *
 * 아래 여백(`pb`)은 **패널 높이보다 작아야 한다.** 상자가 border-box 라 여백이 패널보다 크면 패널이 여백
 * 크기로 커져 창 밖으로 넘치고(`overflow-hidden` 에 가려 안 보인다), `--reserve` 를 그 안 보이는 바닥에서
 * 재서 맨 아래 줄이 독 밑으로 숨었다 — 390 에서 패널 280 에 `pb-80`(320)이라 01:33 질문 줄이 최대 39px
 * 덮였다. 그래서 넓은 화면도 208 이다(+ 타임라인 위 여백 24 = 232) — 낮은 노트북(1366×650)의 창이 300 까지
 * 줄어 패널이 244 가 되므로, 예전 넓은 화면 값 320 이면 같은 일이 데스크톱에서 났다. 좁은 화면 208(+ 16)은
 * 창이 가장 낮을 때(340)의 패널 256 보다 작다. 동시에 `--reserve` + 맞춰 내릴 한 행(좁은 화면에서 가장 긴 줄
 * 약 130px, 넓은 화면 약 85px)보다는 커야 한다 — 스크롤이 거기까지 닿아야 줄 머리에 맞출 수 있다.
 */
const FOLLOW_BOX = "pb-52 [--reserve:60px] lg:[--reserve:76px]";

/** sticky 머리가 있는 탭에서 줄 머리에 맞추려고 `want` 아래로 더 내려가도 되는 한도(px). 독 틈 남짓이다. */
const SNAP_SLACK = 32;

/**
 * 탭 본문의 스크롤 상자가 곧 tabpanel 이다. 키보드로 굴릴 수 있게 탭 순서에 들고(Chrome 이 이름 없는
 * 상자로 저절로 끼우던 자리), 이름은 고른 탭이 준다. 링은 상자 안쪽에 그린다(창이 바깥을 자른다).
 */
type PanelProps = {
  role: "tabpanel";
  id: string;
  "aria-labelledby": string;
  tabIndex: number;
};
const PANEL_FOCUS = cn(FOCUS, "focus-visible:outline-offset-[-3px]");

/* ── 탭 ─────────────────────────────────────────────────────────────── */

/**
 * 방향키로 옮기면 선택도 같이 바뀐다(automatic activation). **출발점은 포커스가 선 탭이다** — 대본이 탭을
 * 옮길 때는 선택만 바뀌고 포커스는 그대로라, 선택값에서 출발하면 다음 →가 엉뚱한 탭 옆으로 간다.
 */
function useTabKeys(value: NoteTab, onChange: (t: NoteTab) => void) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    const last = NOTE_TABS.length - 1;
    const els = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
    const focused = els.indexOf(event.target as HTMLElement);
    const at = focused >= 0 ? focused : NOTE_TABS.indexOf(value);
    const next =
      event.key === "ArrowRight"
        ? at >= last
          ? 0
          : at + 1
        : event.key === "ArrowLeft"
          ? at <= 0
            ? last
            : at - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(NOTE_TABS[next]);
    els[next]?.focus();
  };
}

/**
 * 앱의 밑줄 탭(`note-panel.tsx` `TabsList variant="line"`). 순서는 정보 · 스크립트 · 타임라인 · 요약,
 * 무게는 둘 다 medium, 지금 탭만 먹색 + 2px 먹색 밑줄, 나머지는 먹색 60%. 글자만 앱 12px 에서 13px 로 한 단
 * 키웠다. 밑줄은 앱처럼 **한 프레임에 옮겨 간다** — 줄고 자라는 전이를 두었더니 두 탭이 같이 고른 것처럼
 * 보이는 프레임이 생겼다.
 *
 * `pointer` 는 탭 위의 커서다(회의 중에 앱이 스스로 탭을 옮기지 않으니 사람이 누른 것이다). **커서가 먼저
 * 와 있고, 탭이 바뀌는 순간 누른다** — 받아 적기가 끝나 머무는 동안 미끄러져 와 서 있다가(`press` 거짓),
 * 탭이 바뀌는 렌더에서 같은 커서가 그 자리에서 고리만 퍼뜨린다(`press` 참, 지연 0). 같은 자리의 같은
 * 요소라 다시 미끄러지지 않는다. 커서 끝은 글자 아래 밑줄 높이에 둔다 — 몸통은 창 본문 위 여백으로
 * 내려가고 탭 이름을 덮지 않는다.
 */
function NoteTabs({
  value,
  onChange,
  uid,
  pointer,
}: {
  value: NoteTab;
  onChange: (t: NoteTab) => void;
  uid: string;
  pointer: { tab: NoteTab; press: boolean } | null;
}) {
  return (
    <div
      role="tablist"
      aria-label="노트 화면 미리 보기"
      onKeyDown={useTabKeys(value, onChange)}
      className="order-last -mb-px flex h-10 w-full items-stretch gap-4 lg:order-none lg:h-14 lg:w-auto lg:gap-5"
    >
      {NOTE_TABS.map((tab, i) => {
        const on = tab === value;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`${uid}-tab-${i}`}
            aria-controls={`${uid}-panel`}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab)}
            // 누름 칸은 양옆으로 8px 씩 넓힌다(`before`, 27px → 43px) — 탭 사이(gap 16 · 20)를 반씩 나눠
            // 이웃과 겹치지 않는다. 보이는 크기와 밑줄은 그대로다.
            className={cn(
              "relative flex cursor-pointer items-center px-0.5 text-[13px] font-medium whitespace-nowrap transition-colors before:absolute before:-inset-x-2 before:inset-y-0",
              on ? APP.ink : "text-[var(--el-ink)]/60 hover:text-[var(--el-ink)]",
              FOCUS,
              "focus-visible:outline-offset-[-3px]"
            )}
          >
            {tab}
            {on ? (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--el-ink)]" />
            ) : null}
            {pointer?.tab === tab ? (
              <Cursor press={pointer.press} delay={-450} className="top-[95%] left-[58%]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ── 상단바 ─────────────────────────────────────────────────────────── */

/**
 * 노트 상단바(`note-panel.tsx` `note-top-bar`). 넓으면 한 줄 `상태 · 제목 … 탭 넷 [회의 종료] [⋯]`, 좁으면
 * 앱처럼 탭이 둘째 줄로 내려간다(`max-sm:order-last`). 앱의 맨 앞 ← · ⤡ 는 잘라 보이기로 뺐다 — 중지된
 * 뒤 「⋯」가 붙어도 제목 「3차 스프린트 킥오프」가 다 선다. 좁은 화면에서는 제목이 말줄임 대신 두 줄로
 * 내려간다. 단 **360 미만(320)은 「⋯」도 잘라 보이고 제목을 한 줄로 묶는다** — 「중지됨」 · 「회의 종료」 · 「⋯」가
 * 같이 서면 제목이 「3차 스프린트 / 킥오프」로 갈려 상단바가 17px 자랐다(본문이 장면 한가운데서 밀렸다).
 * 「⋯」는 상태가 아니라 메뉴 단추라 빼도 같은 화면이다. 옆 여백 · 틈도 2px 씩 줄여 말줄임이 서지 않게 한다.
 *
 * 「회의 종료」는 기록 중에는 비활성이다(중지한 뒤에야 끝낼 수 있다, APP-695). 앱은 버튼 전체를
 * `disabled:opacity-45` 로 흐리는데, 그러면 글자가 흰 바탕 2.1:1 이 되어 랜딩의 대비 규칙(정보 글자 4.5:1)에
 * 걸린다. 그래서 **글자는 불투명한 앱 붉은색(4.8:1) 그대로 두고, 테두리(35%) · 아이콘(45%)만 흐려** 비활성으로
 * 읽히게 한다. 그림이라 늘 `aria-hidden` 이다 — 상태는 상단바 「기록 중」 칩 · ① 쪽지 · figcaption 이 말한다. 끝나면 **먼저 글자와 테두리가
 * 사라지고(0.12초), 그다음 폭이 접힌다** — 폭부터 접으면 붉은 테두리 안에 「◎ 회」만 남은 반쪽 버튼이
 * 보였다. 한 바퀴 돌아 다시 펼칠 때는 거꾸로 **폭이 먼저 벌어지고(0.45초) 글자 · 테두리는 그 뒤에 든다** —
 * 같은 전이를 양쪽에 걸었더니 글자 · 테두리가 0.12초에 먼저 서서 「◎ 회의」 반쪽이 0.45초 보였다. 전이는
 * 도착하는 상태의 것이 쓰이므로 기본(펼침)과 `data-[gone]`(접힘)에 따로 둔다. 폭이 바뀌는 동안 탭 넷은
 * 앱처럼 미끄러진다(0.45초, 한 번에 튀지 않게). 「⋯」는 기록 중이 아닐 때만 선다.
 *
 * 상태 칩의 주석은 **칩 하나에 하나**다 — 「중지됨」은 손그림 동그라미(멈춘 장면 동안), 「종료됨」은 노란
 * 고리 한 번. 둘을 같이 걸었더니 테두리가 두 겹으로 보였다. 칩 오른쪽에 제 자리(6 + 4px)를 둬서 고리 ·
 * 동그라미가 제목 「3차」에 닿지 않는다.
 */
function TopBar({
  demo,
  scene,
  uid,
  pointer,
}: {
  demo: Demo;
  scene: Scene;
  uid: string;
  pointer: { tab: NoteTab; press: boolean } | null;
}) {
  const { status } = demo;
  const recording = status === "기록 중";
  const gone = status === "종료됨";
  const pointing = scene === "paused" || scene === "press";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 border-b border-[var(--el-hairline)] px-3 max-[359px]:gap-x-1.5 max-[359px]:px-2.5 lg:h-14 lg:flex-nowrap lg:gap-x-3 lg:px-5">
      <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1 lg:h-14 lg:py-0">
        <span className="relative mr-1 flex shrink-0">
          <span key={status} className={cn("-ml-1.5 rounded-full px-1.5 py-1", gone && "tv-ring")}>
            <StatusChip status={status} />
          </span>
          {scene === "paused" ? (
            <Scribble
              kind="circle"
              draw="mount"
              className="absolute -top-1.5 -left-3 h-[calc(100%+12px)] w-[calc(100%+20px)]"
            />
          ) : null}
        </span>
        <span
          className={cn(
            "min-w-0 text-[13px] leading-[1.35] font-semibold break-keep max-[359px]:truncate lg:truncate lg:text-[13.5px]",
            APP.ink
          )}
        >
          {TITLE}
        </span>
      </div>

      <NoteTabs value={demo.noteTab} onChange={demo.setNoteTab} uid={uid} pointer={pointer} />

      {/* 회의 종료(`meeting-controls.tsx` — h32 · r8 · 붉은 테두리와 글자 · 12px). 그림이다. */}
      <span
        aria-hidden
        data-gone={gone ? "" : undefined}
        className="relative flex shrink-0 data-[gone]:-ml-2 motion-safe:[transition:margin_.45s_cubic-bezier(.65,0,.35,1)] motion-safe:data-[gone]:[transition:margin_.45s_cubic-bezier(.65,0,.35,1)_.12s] lg:data-[gone]:-ml-3"
      >
        <span
          data-gone={gone ? "" : undefined}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 overflow-hidden rounded-[8px] border border-[var(--el-error)] bg-white px-2 text-[12px] font-medium whitespace-nowrap lg:h-8 lg:px-2.5",
            "[max-inline-size:8rem] data-[gone]:border-transparent data-[gone]:px-0 data-[gone]:opacity-0 data-[gone]:[max-inline-size:0]",
            // 펼칠 때: 폭이 먼저 벌어지고, 글자 · 테두리는 다 벌어질 즈음(0.4초) 든다.
            "motion-safe:[transition:max-inline-size_.45s_cubic-bezier(.65,0,.35,1),padding_.45s_cubic-bezier(.65,0,.35,1),opacity_.15s_ease-out_.4s,border-color_.15s_ease-out_.4s]",
            // 접을 때: 글자 · 테두리가 0.12초에 사라지고, 폭은 그 뒤에 접힌다.
            "motion-safe:data-[gone]:[transition:opacity_.12s_ease-out,border-color_.12s_ease-out,max-inline-size_.45s_cubic-bezier(.65,0,.35,1)_.12s,padding_.45s_cubic-bezier(.65,0,.35,1)_.12s]",
            APP.rec,
            recording && "border-[var(--el-error)]/35",
            demo.pressing && "tv-press"
          )}
        >
          <CircleStop
            aria-hidden
            className={cn("size-3.5 shrink-0 lg:size-4", recording && "opacity-45")}
          />
          회의 종료
        </span>
        {/* 커서 끝은 글자 밑 아래 가장자리 — 「종료」를 덮지 않는다. */}
        {pointing ? <Cursor press={scene === "press"} className="top-[84%] left-[58%]" /> : null}
      </span>

      {recording ? null : (
        <span
          aria-hidden
          className={cn(
            "tv-pop inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] border max-[359px]:hidden lg:size-8",
            APP.line,
            APP.muted
          )}
        >
          <MoreHorizontal className="size-4" />
        </span>
      )}
    </div>
  );
}

/* ── 녹음 독 ───────────────────────────────────────────────────────── */

/**
 * 녹음 독(`recording-dock.tsx`). 흰 알약 · 가는 선 · 앱 그림자(앱에서 떠 있는 부품이라 선과 그림자를 둘 다
 * 가진다) — `[마이크 | 붉은 시각 · 파형 다섯 · ■]`. 중지되면 오른쪽이 붉은 원(재개)이 되고, 끝나면 8px
 * 가라앉으며 사라진다(언마운트하지 않는다). 시각은 지금 말하는 줄의 시각이다 — 따로 흐르는 시계를 두면
 * 스크립트의 시각과 어긋난다. 통째로 그림이라 읽히지 않는다(바뀌는 숫자를 읽어 주지 않는다). 새 줄이 독
 * 밑으로 숨지 않게 따라가는 탭은 바닥에 독 자리를 비운다(`FOLLOW_BOX`).
 *
 * ■ 누르기: 중지 장면에 들어서면 커서가 ■ 위로 미끄러져 와 서고, 무대가 대본을 붙잡아 둔 동안
 * (`holding`, 「① 먼저 멈추고」를 읽는 틈) 기다렸다가, 풀리는 순간 누른다(누름 고리 · `tv-press`). 그래서
 * 누른 뒤 1.4초 박자 안에 「중지됨」이 된다 — 붙잡는 동안 이미 눌려 있으면 누르고도 한참 안 멈추는 것처럼
 * 보인다.
 */
function Dock({ demo, scene, holding }: { demo: Demo; scene: Scene; holding: boolean }) {
  const gone = demo.status === "종료됨";
  const at = demo.live?.line.at ?? demo.lines[demo.lines.length - 1].at;
  const pointing = scene === "stop";
  const pressing = demo.stopping && !holding;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center lg:bottom-4"
    >
      <span
        data-gone={gone ? "" : undefined}
        className={cn(
          "tv-dock flex h-10 items-center rounded-full border bg-white/95 p-1 shadow-e2 data-[gone]:translate-y-2 data-[gone]:opacity-0 lg:h-11",
          APP.line
        )}
      >
        <span className={cn("flex size-8 items-center justify-center lg:size-9", APP.muted)}>
          <Mic className="size-4" />
        </span>
        <span className="mx-1 h-5 w-px bg-[var(--el-hairline)]" />
        {demo.status === "기록 중" ? (
          <span className="flex items-center gap-2 pr-1 pl-2">
            <span className="min-w-12 font-mono text-[13px] font-semibold text-[var(--el-error)] tabular-nums">
              {at}
            </span>
            <span className="mx-0.5 flex h-5 w-8 items-center justify-center gap-[3px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  style={vars({ "--i": i })}
                  className="tv-level h-4 w-[3px] rounded-full bg-[var(--el-error)]"
                />
              ))}
            </span>
            <span
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full lg:size-9",
                APP.faint,
                pressing && "tv-press"
              )}
            >
              <Square className="size-3.5" />
              {pointing ? <Cursor press={pressing} className="top-[70%] left-[68%]" /> : null}
            </span>
          </span>
        ) : (
          <span className="flex shrink-0 items-center px-1">
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--el-error)] shadow-sm lg:size-9">
              <span className="size-2.5 rounded-full bg-white" />
            </span>
          </span>
        )}
      </span>
    </div>
  );
}

/* ── 정보 탭 ───────────────────────────────────────────────────────── */

const PEOPLE = ["김민서", "박지훈", "이서연", "정우재"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn("text-[12px] font-semibold", APP.ink)}>{label}</span>
      {children}
    </div>
  );
}

/**
 * 정보 탭(`note-details.tsx`). 카드가 없다 — 위는 편집(제목 · 참석자 · 변경 저장), 아래는 읽기(회의 정보
 * 표)이고 둘 사이는 컨트롤 테두리가 가른다. 표의 생성 · 최종 수정은 앱의 날짜 형식(`dateStyle: medium`)이다.
 */
function DetailsPanel({ ended, at, panel }: { ended: boolean; at: string; panel: PanelProps }) {
  const facts: Array<[string, ReactNode]> = [
    [
      "진행자",
      <>
        <Face who="김민서" size={22} />
        <span className="ml-1">
          김민서
          <span className={cn("font-normal", APP.muted)}>{" · 기록 제어 권한"}</span>
        </span>
      </>,
    ],
    [
      "누적 기록 시간",
      <>
        <span className="tabular-nums">{ended ? LENGTH : at}</span>
        <span className={cn("font-normal", APP.muted)}>· 종료된 구간만 합산</span>
      </>,
    ],
    ["공유 범위", "워크스페이스 멤버에게 공개"],
    ["생성", "2026. 9. 1. 오후 2:00"],
    ["최종 수정", "2026. 9. 1. 오후 2:02"],
  ];
  return (
    <div {...panel} className={cn("h-full overflow-y-auto px-4 pt-5 pb-20 lg:px-8 lg:pt-6", PANEL_FOCUS)}>
      <div className="flex flex-col gap-4">
        <Field label="제목">
          <span
            className={cn(
              "flex h-9 items-center rounded-[8px] border border-[var(--el-hairline-strong)] px-2.5 text-[14px]",
              APP.ink
            )}
          >
            {TITLE}
          </span>
        </Field>
        <Field label="참석자">
          <span className="flex flex-wrap items-center gap-2.5">
            <FacePile names={PEOPLE} size={28} />
            <span
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
                APP.line,
                APP.softBg,
                APP.ink
              )}
            >
              <UserPlus aria-hidden className="size-4" />
              참여자 선택
            </span>
          </span>
        </Field>
        <span
          className={cn(
            "inline-flex h-8 w-fit items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium",
            APP.primary
          )}
        >
          <Check aria-hidden className="size-4" />
          변경 저장
        </span>
      </div>
      <section className="mt-6 flex flex-col">
        <p className={cn("m-0 mb-2.5 text-[13px] font-semibold", APP.ink)}>회의 정보</p>
        <dl className="m-0 flex flex-col">
          {facts.map(([k, v]) => (
            <Fragment key={k}>
              {k === "생성" ? (
                <span aria-hidden className="my-2.5 block h-px w-full bg-[var(--el-hairline)]" />
              ) : null}
              <div className="flex min-h-[30px] items-center gap-3">
                <dt className={cn("w-[100px] shrink-0 text-[12px] lg:w-[124px]", APP.body)}>{k}</dt>
                <dd
                  className={cn(
                    "m-0 flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] font-medium break-keep",
                    APP.ink
                  )}
                >
                  {v}
                </dd>
              </div>
            </Fragment>
          ))}
        </dl>
      </section>
    </div>
  );
}

/* ── 스크립트 탭 ───────────────────────────────────────────────────── */

/**
 * 받아 적는 줄을 「확정된 앞부분」과 「다음 조각이 갈아치울 뒷부분」으로 가른다 — 앱은 앞부분을 진하게,
 * 뒷부분을 옅게 그린다(`transcript-view.tsx`). 여기는 업체가 없으니 끝의 여섯 글자를 뒷부분으로 친다.
 */
function splitLive(text: string) {
  const cut = Math.max(0, text.length - 6);
  return [text.slice(0, cut), text.slice(cut)] as const;
}

const CARET = (
  <span
    aria-hidden
    className="tv-caret ml-1 inline-block h-4 w-px bg-[var(--el-muted)] align-middle"
  />
);

/**
 * 스크립트 탭(`transcript-view.tsx`). 줄은 `mono 시각 | (회의 뒤에만) 화자 칩 / 말`. **회의 중에는 화자가
 * 없다** — 화자는 끝난 뒤에 갈리고, 붙는 것은 이름이 아니라 「화자 A」다. 받아 적는 줄은 같은 격자에 옅은
 * 면이 깔리고, 확정되는 순간 면만 빠진다(같은 `key` 라 글자가 한 픽셀도 안 움직인다).
 *
 * 복사 줄은 앱처럼 위에 붙어 있다(`transcript-view.tsx` 의 `sticky top-0 bg-white`) — 위로 밀려난 줄은
 * 그 밑으로 들어가고, 밑단의 짧은 흰 그러데이션이 끝을 흐린다. 머리 바로 밑은 대개 한 발화의 머리이지만,
 * 줄 머리에 맞추려면 한 행 가까이 비워야 할 때(좁은 화면)는 맞추지 않고 바닥을 따라간다 — 잘린 앞 줄의
 * 머리는 이 sticky 머리가 덮고, 꼬리만 받아 적는 줄 위에 보인다(`useSnapFollow`). 모바일에서도 받아 적는
 * 줄 위에 앞의 말이 적어도 한 줄은 남는다. **스크롤 상자에는 위 여백을 두지 않는다** — sticky 는 상자의 여백 안쪽에 붙어서, 여백이
 * 있으면 머리 위 12~16px 틈으로 지나간 줄(모바일은 글자 아랫절반, 데스크톱은 앞 줄의 선)이 비쳤다. 위 여백은
 * 머리가 제 안에 갖는다.
 *
 * 받아 적는 줄은 `data-mark` 다 — 무대의 쪽지 화살표가 그 줄 높이를 가리킨다(`hero-stage.tsx`).
 *
 * 받아 적는 줄은 **글자가 올 때만 보인다**(앱은 글자가 든 부분 결과가 있을 때만 그 줄을 세운다,
 * `transcript-view.tsx` 의 `partial ?`). 말머리가 오기 전(대본의 말 대목 첫 순간)에는 자리만 잡고
 * 숨긴다(`invisible`) — 빼면 첫 글자가 올 때 본문이 한 행 튀고, 보이면 빈 회색 상자에 커서만 깜빡여 입력창처럼
 * 읽혔다. 좁은 화면(lg 미만)은 앱의 좁은 배치처럼 **「● 받아 적는 중」 → 글** 순서로 쌓는다 — 시각 칸은
 * 비운다. 넓은 화면은 시각 칸에 「● 받아 적는 중」을 둔다.
 *
 * **첫 렌더부터 바닥을 따라간다.** 예전에는 글자가 흐르기 시작할 때 따라가기를 켜서, 처음 0.8초 동안 빈
 * 받아 적는 줄이 독 밑에 깔려 있다가 글자가 흐르는 순간 본문이 두 줄 한꺼번에 튀었다. 이제 창이 뜰 때
 * (등장 애니메이션 중) 받아 적는 줄이 독 위에 서도록 자리를 잡고, 그 대가로 맨 위 00:00 줄은 처음부터
 * 복사 줄 밑에 들어가 있다. 기본 줄의 차례 등장(`rise`)은 페이지에 처음 뜰 때만이다.
 */
function ScriptPanel({ demo, panel, rise }: { demo: Demo; panel: PanelProps; rise: boolean }) {
  const { lines, live } = demo;
  const ended = demo.status === "종료됨";
  const rows = [
    ...lines.map((line) => ({ line, typed: undefined as string | undefined })),
    ...(live ? [{ line: live.line, typed: live.text }] : []),
  ];
  const [ref, onScroll] = useSnapFollow([rows.length, live?.text]);
  const unassigned = new Set(rows.map((row) => row.line.who)).size;
  const tool = "inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-medium";

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      {...panel}
      className={cn("group/script relative h-full overflow-y-auto px-4 lg:px-8", FOLLOW_BOX, PANEL_FOCUS)}
    >
      <div
        aria-hidden
        data-snap-head
        className={cn(
          "sticky top-0 z-10 -mx-4 flex items-center justify-end gap-1 bg-white px-4 pt-3 pb-2 lg:-mx-8 lg:px-8 lg:pt-4",
          APP.body
        )}
      >
        {/* 맨 위가 앞 줄의 꼬리면(`data-cut`) 36px — 시각 없이 잘린 꼬리의 첫 줄을 거의 지운다(`useSnapFollow`). */}
        <span className="pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-white to-transparent group-data-[cut]/script:h-9" />
        {ended ? (
          <>
            <span className={tool}>
              <Users className={cn("size-3.5", APP.muted)} />
              화자
            </span>
            <span className={tool}>
              <SkipForward className={cn("size-3.5", APP.muted)} />
              미지정 {unassigned}
            </span>
          </>
        ) : null}
        <span className={cn(tool, "border", APP.line)}>
          <Copy className={cn("size-3.5", APP.muted)} />
          복사
        </span>
      </div>
      <ul className="m-0 mt-1 list-none p-0">
        {rows.map(({ line, typed }, i) => {
          const label = SPEAKER_LABEL[line.who];
          const [firm, soft] = splitLive(typed ?? "");
          const base = rise && i < BASE_LINES;
          const liveLabel = (
            <>
              <span aria-hidden className="tv-blink size-1.5 shrink-0 rounded-full bg-[#ef4444]" />
              받아 적는 중
            </>
          );
          return (
            <li
              key={line.at}
              data-snap
              data-mark={typed === undefined ? undefined : ""}
              style={base ? vars({ "--i": i + 3 }) : undefined}
              className={cn(
                "grid grid-cols-[40px_minmax(0,1fr)] gap-3 py-3.5 lg:grid-cols-[72px_minmax(0,1fr)] lg:gap-5",
                typed === undefined
                  ? "border-b border-[var(--el-hairline)]"
                  : cn("-mx-4 rounded-[6px] px-4", APP.softBg, typed === "" && "invisible"),
                base && "tv-rise"
              )}
            >
              {typed === undefined ? (
                <span className={cn("pt-1 font-mono text-[11px] tabular-nums", APP.muted)}>
                  {line.at}
                </span>
              ) : (
                // 넓은 화면만 시각 칸에 선다. 좁은 화면은 칸을 비우고 글 위에 쌓는다(아래).
                <span
                  className={cn(
                    "hidden items-center gap-1.5 self-start pt-1 text-[11px] whitespace-nowrap lg:flex",
                    APP.muted
                  )}
                >
                  {liveLabel}
                </span>
              )}
              <div className={cn("min-w-0", typed !== undefined && "max-lg:col-start-2")}>
                {typed === undefined ? null : (
                  <span
                    className={cn(
                      "mb-0.5 flex items-center gap-1.5 text-[11px] lg:hidden",
                      APP.muted
                    )}
                  >
                    {liveLabel}
                  </span>
                )}
                {ended ? (
                  <span
                    style={vars({ "--i": i })}
                    className={cn(
                      "tv-rise mb-1 inline-flex items-center gap-1.5 text-[12.5px] font-medium",
                      APP.muted
                    )}
                  >
                    <SpeakerFace label={label} size={18} />
                    화자 {label}
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--el-muted-soft)]" />
                  </span>
                ) : null}
                <p
                  aria-hidden={typed === undefined ? undefined : true}
                  className={cn(
                    "m-0 text-[15px] leading-7 tracking-[0.005em] break-keep",
                    typed === undefined ? APP.ink : APP.body
                  )}
                >
                  {typed === undefined ? (
                    line.text
                  ) : (
                    <>
                      <span className={APP.ink}>{firm}</span>
                      {soft}
                      {CARET}
                    </>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── 타임라인 탭 ───────────────────────────────────────────────────── */

const inFilter = (tone: TimelineTone, filter: (typeof FILTERS)[number]) =>
  filter === "전체" || FILTER_OF[tone] === filter;

/**
 * 방금 붙은 줄의 노란 섬광(창 위 주석, `tv-flash` 키프레임). 줄 위에 곱하기로 얹어서 흰 바탕 · 아이콘 뒤
 * 흰 원은 같이 노랗게, 글자는 그대로 진하게 남는다. 모션을 줄이면 없다.
 */
const FLASH =
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[8px] before:mix-blend-multiply motion-safe:before:[animation:tv-flash_1.6s_ease-out_both]";

/** 처음부터 서 있는 일곱 줄의 개수. 이보다 늘어난 칸만 숫자가 한 번 튄다(창 위 강조). */
const BASE_COUNT = Object.fromEntries(
  FILTERS.map((f) => [
    f,
    TIMELINE.slice(0, BASE_ENTRIES).filter((e) => e.tone && inFilter(e.tone, f)).length,
  ])
) as Record<(typeof FILTERS)[number], number>;

/**
 * 안건 머리(`note-timeline.tsx` 안건 h3). `시간 구간 · 제목 · 개수 · ›` + 기록 중인 마지막 안건에만 「논의
 * 중」. 머리 전체가 접는 버튼이다(앱은 시간 구간이 따로 스크립트로 가는 버튼인데, 여기는 갈 곳이 없다).
 * **앱처럼 한 줄이고 제목은 말줄임한다**(`min-w-0 truncate`). 예전에는 줄바꿈하게 두었더니 320 에서 시각 열과
 * 「논의 중」 사이에 낀 제목이 「온보딩 / 이탈 로그 1⌄ / 수집」 세 줄로 낱말마다 갈렸다. 말줄임을 줄이려고
 * 휴대폰 폭(sm 미만)에서는 시간 구간의 「 – 지금」을 뺀다(`range` 가 노드인 까닭) — 같은 뜻을 「논의 중」 칩이
 * 말한다.
 */
function AgendaButton({
  range,
  title,
  total,
  bump,
  open,
  live,
  listId,
  onToggle,
}: {
  range: ReactNode;
  title: string;
  total: number;
  bump: boolean;
  open: boolean;
  live: boolean;
  listId: string;
  onToggle: () => void;
}) {
  return (
    // 그림 안의 머리라 제목 요소(h3)로 두지 않는다 — 페이지 목차에 끼면 h1 아래 h2 를 건너뛴다.
    <div data-snap>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className={cn(
          "-mx-2 flex min-h-[30px] w-[calc(100%+16px)] cursor-pointer items-center gap-0.5 rounded-[7px] py-0.5 text-left transition-colors hover:bg-[var(--el-canvas-soft)]",
          FOCUS,
          "focus-visible:outline-offset-0"
        )}
      >
        <span className={cn("shrink-0 self-start px-2 pt-[3px] text-[12px] tabular-nums", APP.muted)}>
          {range}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2.5 pr-2 pl-1">
          <span className={cn("min-w-0 truncate text-[15px] leading-[22px] font-semibold", APP.ink)}>
            {title}
          </span>
          {/* 튐은 새 줄이 다 든 뒤(`ROW_IN_MS`)다. */}
          <span
            key={total}
            className={cn(
              "-ml-1 shrink-0 text-[12.5px] tabular-nums",
              APP.muted,
              bump && "tv-bump [animation-delay:300ms]!"
            )}
          >
            {total}
          </span>
          <ChevronRight
            aria-hidden
            className={cn("-ml-1.5 size-3.5 shrink-0", APP.faint, open && "rotate-90")}
          />
          <span className="flex-1" />
          {live ? <LiveChip blink /> : null}
        </span>
      </button>
    </div>
  );
}

/**
 * 타임라인 탭(`note-timeline.tsx`). 넓은 창은 앱처럼 세리프 제목과 칩 셋으로 연다. 골라 보기 줄은 「전체」만
 * 고른 그림이고(눌리지 않는다), 안건 접기는 진짜다. 두 안건 다 **펼친 채로** 시작한다 — 첫 안건을 접어 두면
 * 도는 동안 결정 줄(파란 체크)이 한 번도 안 보였다.
 *
 * 새 줄은 노란 섬광(창 위 주석)과 함께 4px 아래에서 든다. 섬광은 줄 위에 **곱하기로 얹는다**(`FLASH`) —
 * 줄 바탕에 칠하면 세로선을 가리는 아이콘 뒤의 흰 원이 노란 칠에 뚫린 흰 알약으로 보였다. 바닥을 따라가되
 * 창 맨 위는 늘 한 줄(머리 · 골라 보기 · 안건 · 항목)의 머리에서 시작한다(`useSnapFollow`). 위쪽 20px 은
 * 흐려서 넘어가는 순간도 칼로 자른 듯 보이지 않게 한다.
 *
 * 다음 말이 흐르기 전까지 방금 붙은 줄이 든 목록은 `data-mark` 다 — 무대의 쪽지 화살표가 그 마지막 줄 밑에
 * 닿는다(`hero-stage.tsx`).
 */
function TimelinePanel({ demo, uid, panel }: { demo: Demo; uid: string; panel: PanelProps }) {
  const { entries, live, status } = demo;
  const recording = status === "기록 중";
  const [folded, setFolded] = useState<ReadonlySet<number>>(() => new Set());
  const toggle = (index: number) =>
    setFolded((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  const shown = TIMELINE.slice(0, entries);
  const count = (f: (typeof FILTERS)[number]) =>
    shown.filter((e) => e.tone && inFilter(e.tone, f)).length;

  /** 안건 소속은 순서로 정한다(`timeline.ts` 의 `selectTimeline`). */
  type Group = {
    index: number;
    agenda: Entry;
    end: string | null;
    total: number;
    items: Array<{ index: number; entry: Entry & { tone: TimelineTone } }>;
  };
  const groups: Group[] = [];
  shown.forEach((entry, index) => {
    const current = groups[groups.length - 1];
    if (!entry.tone) {
      if (current) current.end = entry.at;
      groups.push({ index, agenda: entry, end: null, total: 0, items: [] });
      return;
    }
    current.total += 1;
    current.items.push({ index, entry: { ...entry, tone: entry.tone } });
  });
  const last = groups[groups.length - 1];
  const fresh = recording && entries > BASE_ENTRIES && !live?.text;

  const [ref, onScroll] = useSnapFollow([entries, live?.text, folded]);
  const [firm, soft] = splitLive(live?.text ?? "");

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      {...panel}
      className={cn(
        "relative h-full overflow-y-auto px-4 pt-4 [mask-image:linear-gradient(to_bottom,transparent,#000_20px)] lg:px-8 lg:pt-6",
        FOLLOW_BOX,
        PANEL_FOCUS
      )}
    >
      <header data-snap className="hidden lg:block">
        <p
          className={cn(
            "m-0 font-serif text-[28px] leading-[38px] font-medium tracking-[-0.4px]",
            APP.ink
          )}
        >
          {TITLE}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <HeadChip icon="calendar">2026년 9월 1일 오후 2:00</HeadChip>
          <HeadChip icon="people">4명</HeadChip>
          <HeadChip icon="project">{PROJECT}</HeadChip>
        </div>
      </header>

      {/* 골라 보기 칩은 앱처럼 줄바꿈한다 — 좁은 창에서 「참고」가 창 밖으로 밀려나지 않게. */}
      <div
        data-snap
        className={cn(
          "flex flex-col gap-1.5 border-b pb-2.5 lg:mt-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4",
          APP.lineSoft
        )}
      >
        <span aria-hidden className="flex flex-wrap items-center gap-0.5">
          {FILTERS.map((f) => {
            const n = count(f);
            return (
              <span
                key={f}
                className={cn(
                  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2 text-[13px] sm:px-[9px]",
                  f === "전체" ? cn(APP.chipBg, "font-medium", APP.ink) : APP.muted
                )}
              >
                {f}
                <span
                  key={n}
                  className={cn(
                    "text-[12px] font-normal tabular-nums",
                    // 「전체」는 회색 칩 면(#f0efed) 위라 muted 가 4.2:1 — 한 단 짙게.
                    f === "전체" ? APP.body : APP.muted,
                    n !== BASE_COUNT[f] && "tv-bump [animation-delay:300ms]!"
                  )}
                >
                  {n}
                </span>
              </span>
            );
          })}
        </span>
        <span className="sr-only">{`전체 ${count("전체")}개 항목`}</span>
        <span className={cn("text-[12px]", APP.muted)}>
          {status === "종료됨"
            ? "이 회의에서 남길 만한 변화만 기록했습니다"
            : "말이 끝날 때마다 정리됩니다 · 방금 갱신"}
        </span>
      </div>

      {groups.map((group) => {
        const isFolded = folded.has(group.index);
        const listId = `${uid}-agenda-${group.index}`;
        const live = group === last && recording;
        const range = group.end ? (
          `${group.agenda.at} – ${group.end}`
        ) : live ? (
          <>
            {group.agenda.at}
            <span className="max-sm:hidden"> – 지금</span>
          </>
        ) : (
          group.agenda.at
        );
        return (
          <section key={group.index} className="mt-5">
            <AgendaButton
              range={range}
              title={group.agenda.title}
              total={group.total}
              bump={group.items.some((item) => item.index >= BASE_ENTRIES)}
              open={!isFolded}
              live={live}
              listId={listId}
              onToggle={() => toggle(group.index)}
            />
            {/* 새 줄은 바로(창의 순번 `--i:1` 을 끊는다) 0.3초 만에 든다(`ROW_IN_MS`) — 개수 · 쪽지 · 자막이
                그 뒤에 선다. 0.07초 늦게 0.5초 걸려 들 때는 9초에 「3」이 먼저 서고 줄은 아직 투명했다. */}
            <ol
              id={listId}
              hidden={isFolded}
              data-mark={fresh && group === last ? "" : undefined}
              className="relative m-0 mt-1.5 list-none p-0 [--i:0]"
            >
              <span
                aria-hidden
                className="absolute top-4 bottom-4 left-[63px] w-px bg-[var(--el-hairline)]"
              />
              {group.items.map(({ index, entry }) => (
                <TimelineRow
                  key={index}
                  at={entry.at}
                  tone={entry.tone}
                  kind={entry.kind}
                  title={entry.title}
                  meta={entry.meta}
                  className={
                    index < BASE_ENTRIES
                      ? undefined
                      : cn("tv-rise [animation-duration:300ms]!", recording && FLASH)
                  }
                />
              ))}
            </ol>
          </section>
        );
      })}

      {/* 받아 적는 중인 말. 화자 칸은 없다. 정리해 붙인다고 약속하지 않는다 — 대부분의 말은 항목이 되지 않는다.
          스크립트 탭과 같이 글자가 올 때만 보인다(자리는 잡아 둔다). 앞부분은 `APP.body`, 다음 조각이 갈아치울
          꼬리 여섯 글자(`soft`)는 한 단 옅은 `APP.muted`(4.8:1)다 — 앱의 「진한 확정 · 옅은 미확정」 두 단을 그대로
          두되 둘 다 읽히는 대비로 올렸다(예전 꼬리는 `APP.faint` 2.5:1 이라 다 적힌 뒤 붙잡는 동안 「…여기까지입니다.」
          같은 실제 낱말이 흐리게 섰다). 대비 규칙의 예외는 없다. */}
      {live && recording ? (
        <div
          aria-hidden
          className={cn(
            "mt-4 grid grid-cols-[44px_40px_minmax(0,1fr)] border-t border-dashed border-[var(--el-hairline)] pt-4",
            !live.text && "invisible"
          )}
        >
          <span />
          <span className="flex justify-center pt-[9px]">
            <span className="tv-blink size-1.5 rounded-full bg-[#ef4444]" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn("text-[15px] leading-6 break-keep", APP.muted)}>
              <span className={APP.body}>{firm}</span>
              {soft}
              {CARET}
            </span>
            <span className={cn("text-[12.5px] leading-[19px]", APP.muted)}>받아 적는 중</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ── 요약 탭 ───────────────────────────────────────────────────────── */

const STEPS = ["화자 나누기", "분석", "검토", "확정"];

/**
 * 분석 대기(`flow-notice.tsx` ANALYZING). 화자 나누기는 끝났고 분석이 도는 중이다 — 끝나는 시각을 모르는
 * 서버 작업이라 스피너 + 왜 기다리는지 한 줄이다. 앱에서는 시간이 걸리는 것을 대본이 1.7초로 줄였고,
 * 그 사실을 숨기지 않으려고 빈자리에 「>>>」 쪽지(창 위 주석)를 얹는다.
 *
 * 예전에는 먹색 알약에 흰 글자 「빨리 감기」였다 — 앱의 주 버튼(먹색 바탕 흰 글자)이나 재생기의 빨리 감기
 * 단추처럼 보여, 분석을 건너뛰는 앱 버튼으로 읽힐 수 있었다. 그래서 페이지의 주석 모양(노란 쪽지 · 기울임)
 * 으로 바꿨다. **쪽지에는 글자가 없다** — 「빨리 감는 중」이라 썼더니 창 밖 쪽지(넓은 화면 위 띠) · 자막(좁은
 * 화면)의 「분석은 여기선 빨리 감았어요」와 한 장면에서 같은 말을 두 번, 시제까지 엇갈려 했다. 말은 창 밖의
 * 「분석은 여기선 빨리 감아요」 한 장이 하고, 여기는 그 말이 가리키는 표시만 남는다.
 */
function Analyzing({ panel }: { panel: PanelProps }) {
  return (
    <div {...panel} className={cn("relative h-full px-4 pt-6 lg:px-10 lg:pt-9", PANEL_FOCUS)}>
      <ol
        aria-label="분석 단계"
        className="m-0 flex list-none flex-wrap items-center gap-2.5 p-0 text-[12px] lg:text-[13px]"
      >
        {STEPS.map((label, at) => {
          const done = at === 0;
          const now = at === 1;
          return (
            <li
              key={label}
              aria-label={`${label}: ${done ? "완료" : now ? "진행 중" : "대기"}`}
              className="flex items-center gap-2.5"
            >
              {at > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-px w-7 sm:block",
                    at <= 1 ? "bg-[var(--el-hairline-strong)]" : "bg-[var(--el-hairline)]"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap",
                  done && APP.body,
                  now && cn("font-semibold", APP.ink),
                  !done && !now && APP.muted
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    done
                      ? "border-[var(--el-ink)] bg-[var(--el-ink)] text-white"
                      : "border-[var(--el-hairline-strong)]",
                    now && APP.ink,
                    !done && !now && APP.muted
                  )}
                >
                  {done ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : now ? (
                    <LoaderCircle className="size-3 animate-spin" />
                  ) : (
                    at + 1
                  )}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 gap-y-1.5 lg:mt-10">
        <span
          aria-hidden
          className="mt-[3px] block size-[18px] shrink-0 animate-spin rounded-full border-2 border-[var(--el-hairline-strong)] border-t-[var(--el-ink)]"
        />
        <span className={cn("text-[15.5px] font-medium lg:text-[17px]", APP.ink)}>
          회의를 분석하는 중입니다
        </span>
        <p className={cn("col-start-2 m-0 max-w-[54ch] text-[13.5px] leading-[22px] break-keep lg:text-[14px] lg:leading-[23px]", APP.muted)}>
          결정과 할 일을 주제로 묶고, 담당과 기한을 붙이고, 프로젝트의 기존 결정 · 할 일과 견줍니다. 몇 분 걸릴 수
          있고, 다른 화면으로 옮겨도 됩니다.
        </p>
      </div>
      {/* 가운데 맞춤은 바깥 줄이 한다 — 튀어나오는 애니메이션(`tv-pop`)이 `translate` 를 쓴다. */}
      <span aria-hidden className="absolute inset-x-0 top-[74%] flex justify-center lg:top-[60%]">
        <Sticky
          tone="pop"
          tilt={-3}
          anim="pop"
          delay={250}
          className="inline-flex items-center"
        >
          <Scribble kind="chevrons" color="ink" draw="mount" className="h-5 w-12" />
        </Sticky>
      </span>
    </div>
  );
}

const seconds = (at: string) => {
  const [m, s] = at.split(":").map(Number);
  return m * 60 + s;
};
/** 회의 길이 위의 자리(`meeting-map.tsx` 의 `at`). */
const onTrack = (at: string) => `${((seconds(at) / seconds(LENGTH)) * 100).toFixed(2)}%`;

/**
 * 「언제 정해졌나」(`meeting-map.tsx`). 앱에서도 상자다(hairline-soft · r12). 회의 길이 위에 주제 구간을
 * 깔고 결정 · 할 일이 나온 때를 색 막대로 찍는다 — 막대는 하나씩 꽂힌다.
 *
 * **lg 미만은 상자 대신 위아래 구분선이다.** 좁은 창은 본문 여백이 16px 라 상자가 창 양옆 16px 안쪽에 나란히
 * 서서 창과 동심 두 겹으로 읽혔다(`EvidenceQuotes` 가 sm 미만에서 상자를 세로선으로 바꾼 것과 같은 까닭).
 * 넓은 창은 본문 여백이 40px 라 앱 상자 그대로다.
 */
function MeetingMap() {
  const marks = [
    ...DOC.decisions.map((d) => ({ at: d.at, color: ROLE_COLOR.decision })),
    ...DOC.tasks.map((t) => ({ at: t.at, color: ROLE_COLOR.task })),
  ];
  return (
    <div
      aria-hidden
      className="mt-6 border-y border-[var(--el-hairline-soft)] pt-3.5 pb-2.5 lg:rounded-[12px] lg:border-x lg:px-4"
    >
      <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px]", APP.muted)}>
        <span className={cn("font-medium", APP.body)}>언제 정해졌나</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-[5px]">
            <span className="h-1.5 w-3 rounded-[2px] bg-[var(--el-hairline)]" />
            주제 구간
          </span>
          <span className="inline-flex items-center gap-[5px] tabular-nums">
            <span className="h-2.5 w-[3px] rounded-[2px]" style={{ background: ROLE_COLOR.decision }} />
            결정 {DOC.decisions.length}
          </span>
          <span className="inline-flex items-center gap-[5px] tabular-nums">
            <span className="h-2.5 w-[3px] rounded-[2px]" style={{ background: ROLE_COLOR.task }} />
            할 일 {DOC.tasks.length}
          </span>
        </span>
      </div>
      <div className="relative mt-2 h-[26px]">
        {DOC.topics.map((topic, i) => {
          const end = DOC.topics[i + 1]?.at ?? LENGTH;
          return (
            <span
              key={topic.at}
              className="absolute top-2.5 h-1.5 rounded-[2px] bg-[var(--el-hairline)]"
              style={{
                left: onTrack(topic.at),
                width: `calc(${(((seconds(end) - seconds(topic.at)) / seconds(LENGTH)) * 100).toFixed(2)}% - 2px)`,
              }}
            />
          );
        })}
        {marks.map((mark, i) => (
          <span
            key={mark.at}
            className="tv-pop absolute top-1.5 -ml-[1.5px] h-3.5 w-[3px] rounded-[2px]"
            style={{ left: onTrack(mark.at), background: mark.color, ...vars({ "--d": `${200 + i * 90}ms` }) }}
          />
        ))}
      </div>
      <div className={cn("flex h-4 justify-between text-[11px] tabular-nums", APP.muted)}>
        <span>0:00</span>
        <span>2분</span>
      </div>
    </div>
  );
}

/** 요약 / 그래프 전환(`SegmentedControl`). 그림이다. */
const VIEW_SWITCH = (
  <span
    aria-hidden
    className={cn("inline-flex h-8 items-center rounded-full p-[3px] text-[12px] font-medium", APP.chipBg)}
  >
    <span className={cn("rounded-full bg-white px-3 py-1 shadow-[0_1px_2px_#0c0a0914]", APP.ink)}>요약</span>
    {/* 회색 칩 면 위라 muted 는 4.2:1 — 한 단 짙게. */}
    <span className={cn("px-3", APP.body)}>그래프</span>
  </span>
);

/**
 * 검토 문서가 장면마다 창 맨 위에 세울 묶음. 바닥을 따라가지 않는다 — 그러면 창 첫 줄이 위가 잘린 근거
 * 상자이고, 그 상자가 속한 결정과 「검토 중」 머리는 창 밖으로 밀려났다(모션을 줄인 사람에게는 마지막
 * 장면이 히어로의 전부다). **폭만 보지 않고 그 묶음이 창에 드는지도 본다**(`fits`, 잰 값).
 *
 * - 요약 · 주제가 선 때: 「요약」 머리.
 * - 근거: 「결정 2」 머리 — 결정 둘 · 펼친 근거(맥락 한 줄 + 인용 한 줄)가 창에 다 들 때. 안 들면(낮은 노트북
 *   1366×650 · 1024×640, 휴대폰) 펼친 결정 줄을 맨 위로 올린다 — 「결정 2」 머리에 맞췄더니 쪽지 화살표가
 *   가리키는 인용 줄이 창 바닥에서 반쯤 잘렸다.
 * - 검토 막대(넓은 창): 펼친 결정 줄이 막대 위에 다 들면 그 줄. 결정 머리와 첫 결정은 위로 넘어가고 펼친 근거
 *   · 「할 일 2」가 막대 위에 든다. 막대에 걸리는 줄은 막대 뒤 흰 막이 통째로 덮는다(`place`).
 * - 검토 막대(좁은 창, 또는 펼친 결정이 막대 위에 안 드는 낮은 창): 「할 일 2」 머리. 막대가 창의 4분의 1을
 *   덮어 결정과 할 일이 같이 들 수 없다 — 근거는 앞 장면에서 봤고, 마지막 장면은 담당(「화자 D」)과 기한이 선
 *   할 일을 보인다.
 */
function anchorOf(review: number, wide: boolean, fits: (name: "decisions" | "open") => boolean) {
  if (review >= 4) return wide && fits("open") ? "open" : "tasks";
  if (review === 3) return fits("decisions") ? "decisions" : "open";
  return review === 2 ? "summary" : null;
}

/**
 * 검토 줄(`DecisionRow` · `TaskRow`)의 아래 여백 — 앱 줄 격자의 `py-[11px]`. 막대에 걸리는지 볼 때 이만큼은
 * 글자가 없는 자리라 흰 막의 흐림 띠에 들어가도 된다. 머리 줄(`data-row="head"`)은 여백이 없다.
 */
const ROW_PAD = 11;

/** 묶음 머리 위에 두는 표시. 머리가 창 맨 위에서 12px 아래 선다. */
const Anchor = ({ name }: { name: string }) => <span aria-hidden data-anchor={name} className="block" />;

/**
 * 근거 발언(`lib/notes/review/moments.ts` 의 `quotesOf`) — 인용한 줄과 그 바로 앞 줄(맥락, 회색). 아래
 * 근거 구간의 요약 창과 같은 모양이다.
 */
const quotesOf = (cites: readonly number[]) =>
  [...new Set(cites.flatMap((c) => (c > 0 ? [c - 1, c] : [c])))]
    .sort((a, b) => a - b)
    .map((at) => ({
      label: SPEAKER_LABEL[TRANSCRIPT[at].who],
      at: TRANSCRIPT[at].at,
      text: TRANSCRIPT[at].text,
      cited: cites.includes(at),
    }));

/**
 * 검토 문서(`review-board.tsx`) — 머리 → 「언제 정해졌나」 → 요약 → 주제 → 결정 → 할 일, 아래 가운데에 떠
 * 있는 검토 막대. 묶음이 하나씩 서고, 장면마다 정해 둔 묶음(`anchorOf`)이 창 맨 위로 온다 — 앞 장면에서
 * 넘어올 때는 사람이 굴리듯 부드럽게 간다(모션을 줄이면 바로). 막대가 서기 전에는 아래에 빈 자리를 둬서 그
 * 위치까지 올릴 수 있다. 할 일은 근거 장면부터 선다 — 그 전에는 창 아래 절반이 2초 넘게 비어 문서가 거기서
 * 끝난 것처럼 보였다.
 *
 * 펼친 결정은 **둘째 줄**(00:14, 「결제 화면 개편은…」)이다. 근거 상자(`data-mark`)의 인용 줄을 무대의
 * 쪽지 화살표가 가리킨다. 막대에 걸리는 줄은 흰 막이 통째로 덮는다 — 그러데이션만 두면 막대 위로 글자
 * 윗절반이 비쳤고, 쪽지 화살표가 그 글자를 가로질렀다. 막의 위끝은 그 줄의 머리보다 흐림 띠(14px)만큼 더
 * 위다 — 줄 머리에서 흐리기 시작했더니 1024×768 에서 「할 일 2」 머리 글자 윗절반이 띠 속에 유령처럼 비쳤다.
 *
 * **짧은 패널에서는 막이 창 전체를 덮었다**(1366×650 · 1280×720 · 1024×640 · 320 의 검토 막대 장면과 모션
 * 줄이기 정지 화면 — 탭 줄 아래가 통째로 흰 면에 막대만 떴다). 펼친 결정 줄(근거 상자 포함 ≈ 212~250px)이
 * 막대 위끝보다 길어 그 줄 자신이 「막대에 걸리는 첫 줄」로 잡혔기 때문이다. 그래서 셋을 둔다 — ① 묶음이 안
 * 들면 다른 묶음(`anchorOf` 의 `fits`), ② 걸리는 줄은 보이는 칸 안에서 **시작하는** 줄만 본다(위에서 시작한
 * 긴 줄 하나로 막이 번지지 않게), ③ 막은 창 맨 위 48px 아래로만 올라간다. 줄의 아래 여백(`ROW_PAD`)은 걸려도
 * 된다 — 320 에서 막대가 세 줄로 높아 첫 할 일의 여백 몇 px 이 걸렸고, 그 줄째 덮어 「할 일 2」 머리만 남았다.
 *
 * 근거 장면처럼 막대가 없을 때는 바닥 24px 도 흐린다 — 문서가 굴러가 멈춘 자리에 따라 할 일 줄의 밑선
 * (1440×900, 창 바닥 6px 위)이나 근거 상자의 아랫변(1024×768, 20px 위)이 창 바닥과 나란히 남아 테두리 두
 * 겹으로 읽혔다. 막대가 서면 그 자리는 흰 막이 맡는다. 마지막 장면의 「검토 완료」는 **누르지 않는다** —
 * 앱은 누르면 확인창이 먼저 뜨고, 이 대본에는 확정 상태가 없다. 커서가 버튼 오른쪽 아래 모서리에 와 있고
 * 노란 고리가 두 번 퍼질 뿐이다.
 */
function ReviewDoc({ review, panel }: { review: number; panel: PanelProps }) {
  const ref = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLSpanElement>(null);
  const placedOnce = useRef(false);
  const confirming = review >= 4;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const place = (smooth: boolean) => {
      if (!live) return;
      const bar = barRef.current;
      const cover = coverRef.current;
      /** 막대 위끝(막대가 없으면 창 바닥). */
      const barTop = el.clientHeight - (bar?.offsetHeight ?? 0);
      const anchor = (name: string) => el.querySelector<HTMLElement>(`[data-anchor="${name}"]`);
      const open = anchor("open")?.closest<HTMLElement>("[data-row]");
      /** `name` 머리(창 맨 위 12px)부터 펼친 결정 줄 끝까지가 막대 위(막대가 없으면 창 바닥 8px 위)에 드나. */
      const fits = (name: "decisions" | "open") => {
        const head = anchor(name);
        if (!head || !open) return false;
        const room = bar ? barTop - 6 : el.clientHeight - 8;
        return topIn(open, el) + open.offsetHeight - topIn(head, el) + 12 <= room;
      };
      const name = anchorOf(review, window.matchMedia("(min-width: 1024px)").matches, fits);
      const node = name ? anchor(name) : null;
      const top = Math.max(
        0,
        Math.min(node ? topIn(node, el) - 12 : 0, el.scrollHeight - el.clientHeight)
      );
      el.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
      if (!bar || !cover) return;
      // 보이는 칸 안에서 시작하고, 글자가 막대 위 6px 안까지 내려오는 첫 줄부터 덮는다(그 위 줄의 밑선은 남는다).
      const hidden = [...el.querySelectorAll<HTMLElement>("[data-row]")].find((row) => {
        const y = topIn(row, el) - top;
        const pad = row.dataset.row === "head" ? 0 : ROW_PAD;
        return y > 0 && y + row.offsetHeight - pad > barTop - 6;
      });
      const from = hidden ? topIn(hidden, el) - top : barTop;
      // 흐림 띠(14px)는 덮을 줄 머리 위 빈 여백에 건다. 창 맨 위 48px 은 덮지 않는다.
      cover.style.top = `${Math.max(Math.min(from - barTop - 14, -16), 48 - barTop)}px`;
    };
    place(placedOnce.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    placedOnce.current = true;
    // 세리프 제목 글꼴이 늦게 붙으면 위 묶음 높이가 바뀐다 — 붙은 뒤 한 번 더 맞춘다.
    if (document.fonts?.status === "loading") void document.fonts.ready.then(() => place(false));
    return () => {
      live = false;
    };
  }, [review]);

  return (
    <div
      ref={ref}
      {...panel}
      // 위 12px 를 흐린다 — 묶음 사이를 부드럽게 굴러가는 동안(근거 장면 첫 0.4초) 탭 바로 밑에 반쯤 잘린
      // 줄이 칼로 자른 듯 보이지 않게. 멈춘 자리는 늘 묶음 머리 12px 위라(`place`) 그 띠는 비어 있다. 막대가
      // 없을 때는 바닥 24px 도 흐린다(머리 주석). `data-view` 는 그 바닥 흐림 폭 — 무대가 쪽지가 가리킬 인용
      // 줄이 보이는 칸 안에 들었는지 잴 때 쓴다(`hero-stage.tsx`).
      data-view="24"
      className={cn(
        "relative flex h-full flex-col overflow-y-auto",
        confirming
          ? "[mask-image:linear-gradient(to_bottom,transparent,#000_12px)]"
          : "[mask-image:linear-gradient(to_bottom,transparent,#000_12px,#000_calc(100%-24px),transparent)]",
        PANEL_FOCUS
      )}
    >
      <div className={cn("flex-1 px-4 pt-5 lg:px-10 lg:pt-6", confirming ? "pb-6" : "pb-[360px]")}>
        <div className="chat-rise">
          <ReviewHead
            state="검토 중"
            titleSize="lg"
            title={TITLE}
            aside={VIEW_SWITCH}
            chips={
              <>
                <HeadChip icon="date">9월 1일 (화) 오후 2:00</HeadChip>
                <HeadChip icon="length">2분</HeadChip>
                <FacesChip names={PEOPLE} />
                <HeadChip icon="project">{PROJECT}</HeadChip>
              </>
            }
          />
          <MeetingMap />
          <div className="pt-7">
            <Anchor name="summary" />
            <SectionHead title="요약" />
            <p className={cn("m-0 mt-1.5 text-[15px] leading-[1.8] break-keep", APP.body)}>
              {DOC.summary}
            </p>
          </div>
        </div>

        {review > 1 ? (
          <div className="chat-rise pt-7">
            <SectionHead title="주제" count={DOC.topics.length} />
            <ul className="m-0 mt-1.5 list-none border-t border-[var(--el-hairline-soft)] p-0">
              {DOC.topics.map((topic) => (
                <li key={topic.at} className="border-b border-[var(--el-hairline-soft)]">
                  <div className="-mx-2 grid grid-cols-[44px_minmax(0,1fr)_16px] items-start gap-x-3 px-2 py-3 sm:grid-cols-[56px_minmax(0,1fr)_auto_16px]">
                    <span className={cn("text-[12px] leading-6 tabular-nums", APP.muted)}>{topic.at}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className={cn("text-[15px] leading-6 font-medium break-keep", APP.ink)}>
                        {topic.title}
                      </span>
                      {/* 앱은 한 줄로 말줄임한다. 여기는 줄바꿈해 다 보인다(과장 허용). */}
                      <span className={cn("text-[13.5px] leading-5 break-keep", APP.muted)}>{topic.gist}</span>
                    </span>
                    <span
                      className={cn(
                        "col-start-2 row-start-2 mt-1 flex h-6 items-center gap-2.5 text-[12px] whitespace-nowrap tabular-nums sm:col-start-3 sm:row-start-1 sm:mt-0",
                        APP.muted
                      )}
                    >
                      {topic.counts.map(([tone, n]) => (
                        <span key={tone} className="inline-flex items-center gap-1">
                          <TimelineToneIcon tone={tone} />
                          <span className="sr-only">
                            {tone === "decision" ? "결정" : tone === "task" ? "할 일" : "열린 질문"}{" "}
                          </span>
                          {n}
                        </span>
                      ))}
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={cn("col-start-3 row-start-1 mt-1 size-4 sm:col-start-4", APP.faint)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {review > 2 ? (
          <div className="chat-rise pt-7">
            <Anchor name="decisions" />
            <SectionHead title="결정" count={DOC.decisions.length} />
            <div className="mt-1.5">
              {DOC.decisions.map((decision, i) => (
                // 둘째 줄을 펼친다 — 근거 상자가 할 일 바로 위에 붙어 마지막 장면까지 남는다.
                <div key={decision.at} data-row>
                  {i === 1 ? <Anchor name="open" /> : null}
                  <DecisionRow
                    text={decision.text}
                    topic={decision.topic}
                    at={decision.at}
                    open={i === 1}
                  >
                    <div data-mark>
                      <EvidenceQuotes quotes={quotesOf(decision.cites)} />
                    </div>
                  </DecisionRow>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {review > 2 ? (
          <div className="chat-rise pt-7">
            <Anchor name="tasks" />
            <div data-row="head">
              <SectionHead
                title="할 일"
                count={DOC.tasks.length}
                aside={
                  // 앱은 담당이 이름 없는 화자인 할 일이 있을 때만 이 줄을 세운다. 「화자 D」가 무엇인지는
                  // 이 줄이 말한다.
                  <span className="hidden items-center gap-2 lg:flex">
                    <span className={cn("text-[12px]", APP.muted)}>
                      이름 없는 화자에게 걸린 할 일 {DOC.tasks.length}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-[26px] items-center rounded-full border border-[var(--el-hairline-strong)] px-2.5 text-[12px] font-medium",
                        APP.ink
                      )}
                    >
                      화자 이름 붙이기
                    </span>
                  </span>
                }
              />
            </div>
            <div className="mt-1.5">
              {DOC.tasks.map((task) => (
                <div key={task.at} data-row>
                  <TaskRow text={task.text} who={{ label: task.who }} due={task.due} wide />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {confirming ? (
        <div
          ref={barRef}
          className="chat-rise pointer-events-none sticky bottom-0 flex justify-center px-4 pb-3 lg:px-6 lg:pb-4"
        >
          {/* 흰 막. 위 끝은 `place` 가 막대에 걸리는 첫 줄의 머리보다 14px 위로 올린다. 14px 만 흐린다.
              `data-cover` — 무대가 인용 줄이 이 막 위에 드는지 잰다. */}
          <span
            ref={coverRef}
            data-cover
            aria-hidden
            className="absolute inset-x-0 -top-4 bottom-0 bg-[linear-gradient(to_bottom,transparent,white_14px)]"
          />
          {/* 막대 모양은 창 폭으로 고른다(`app.tsx` `BAR`) — 넓은 창은 앱 그대로의 `float`, 좁은 창은 가운데
              좁은 알약(`pill`, 390 창에서 양옆 약 47px), 300 미만 창(320 화면)은 선 없는 판(`plate`). 좁은 창에
              `float` 를 두면 창 양옆 16px · 바닥 12px 안쪽에 둥근 선이 한 겹 더 섰다. 셋 다 그려 두고 폭으로
              하나만 보인다 — 서버 렌더와 어긋나지 않는다. */}
          {(["plate", "pill", "float"] as const).map((variant) => (
            <ConfirmBar
              key={variant}
              variant={variant}
              className={
                variant === "plate"
                  ? "min-[360px]:hidden"
                  : variant === "pill"
                    ? "max-[360px]:hidden lg:hidden"
                    : "max-lg:hidden"
              }
              state={{ kind: "ready", decisions: DOC.decisions.length, tasks: DOC.tasks.length }}
              buttonSlot={
                <>
                  <span
                    aria-hidden
                    className="tv-ring absolute inset-0 rounded-[inherit]"
                    style={vars({ "--n": 2 })}
                  />
                  {/* 커서 끝은 버튼 오른쪽 아래 모서리 — 「검토 완료」 글자를 덮지 않는다. */}
                  <Cursor className="top-[82%] left-[80%]" delay={300} />
                </>
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 요약 탭(`review-tab.tsx`). 셋 중 하나다 — 끝나기 전의 회색 안내(앱에서는 선 있는 상자), 끝난 직후의 분석
 * 대기, 분석이 끝난 뒤의 검토 문서. 문구는 앱 것 그대로다. 회색 안내는 **선을 빼고 면만** 둔다 — 좁은 창에서
 * 창 양옆 16px 안쪽에 둥근 선이 나란히 서서 창과 동심 두 겹으로 읽혔다.
 */
function SummaryPanel({ demo, panel }: { demo: Demo; panel: PanelProps }) {
  if (demo.status !== "종료됨") {
    return (
      <div {...panel} className={cn("h-full px-4 pt-5 lg:px-8 lg:pt-6", PANEL_FOCUS)}>
        <div className={cn("rounded-[16px] p-5", APP.softBg)}>
          <p className={cn("m-0 text-[14px] font-medium", APP.ink)}>요약은 회의가 끝나면 정리됩니다</p>
          <p className={cn("m-0 mt-1 text-[12px] leading-relaxed break-keep", APP.muted)}>
            회의를 끝내면 결정 · 할 일 · 이슈를 주제로 묶어 검토할 수 있게 됩니다.
          </p>
        </div>
      </div>
    );
  }
  return demo.review === 0 ? (
    <Analyzing panel={panel} />
  ) : (
    <ReviewDoc review={demo.review} panel={panel} />
  );
}

/* ── 창 ─────────────────────────────────────────────────────────────── */

/**
 * 노트 창 안쪽 전부(상단바 + 탭 본문 + 독). 본문은 탭마다 `key` 로 다시 마운트해 살짝 들게 한다.
 *
 * **대본이 탭을 옮기면 본문 안의 포커스가 `<body>` 로 떨어진다**(조건부 렌더라서). 안건 머리에 서 있던
 * 키보드 사용자가 누른 적도 없이 자리를 잃지 않게, 안에 있었으면 고른 탭으로 옮겨 준다
 * (`product-shot.tsx` 의 `NotePanels` 와 같다). 안에 있었는지는 미리 적어 둔다 — 효과가 돌 때는 이미 지워진 뒤다.
 */
export function HeroNote({
  demo,
  scene,
  holding,
  uid,
}: {
  demo: Demo;
  scene: Scene;
  /** 무대가 대본을 붙잡아 둔 중인가(`hero-stage.tsx` 의 붙잡기). */
  holding: boolean;
  uid: string;
}) {
  const tab = demo.noteTab;
  const live = demo.live;
  const at = live?.line.at ?? demo.lines[demo.lines.length - 1].at;
  /**
   * 페이지에 처음 뜬 탭 본문인가. 스크립트 기본 줄의 차례 등장(`tv-rise`)은 이때만 건다 — 한 바퀴 돌아
   * 요약 → 스크립트로 되돌아올 때 또 걸면 본문이 빈 채 받아 적는 줄만 떠 있다가 줄이 하나씩 찼다.
   */
  const [firstTab, setFirstTab] = useState<NoteTab | null>(tab);
  if (firstTab !== null && firstTab !== tab) setFirstTab(null);
  const wasInside = useRef(false);
  useEffect(() => {
    if (!wasInside.current) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    wasInside.current = false;
    document.getElementById(`${uid}-tab-${NOTE_TABS.indexOf(tab)}`)?.focus();
  }, [tab, uid]);

  /** 탭 위의 커서 — 첫 말이 다 받아 적혀 머무는 동안 「타임라인」에 와 서고, 탭이 바뀌는 장면에서 누른다. */
  const pointer: { tab: NoteTab; press: boolean } | null =
    scene === "timeline"
      ? { tab: "타임라인", press: true }
      : scene === "listen" && live && live.text.length === live.line.text.length
        ? { tab: "타임라인", press: false }
        : null;

  const panel: PanelProps = {
    role: "tabpanel",
    id: `${uid}-panel`,
    "aria-labelledby": `${uid}-tab-${NOTE_TABS.indexOf(tab)}`,
    tabIndex: 0,
  };

  return (
    <>
      <TopBar demo={demo} scene={scene} uid={uid} pointer={pointer} />
      <div
        onFocus={() => {
          wasInside.current = true;
        }}
        onBlur={() => {
          wasInside.current = false;
        }}
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <div key={tab} className="chat-rise h-full">
          {tab === "정보" ? (
            <DetailsPanel ended={demo.status === "종료됨"} at={at} panel={panel} />
          ) : null}
          {tab === "스크립트" ? (
            <ScriptPanel demo={demo} panel={panel} rise={firstTab !== null} />
          ) : null}
          {tab === "타임라인" ? <TimelinePanel demo={demo} uid={uid} panel={panel} /> : null}
          {tab === "요약" ? <SummaryPanel demo={demo} panel={panel} /> : null}
        </div>
        <Dock demo={demo} scene={scene} holding={holding} />
      </div>
    </>
  );
}
