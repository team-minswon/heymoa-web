"use client";

import { useId, useState } from "react";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  CircleQuestionMark,
  Copy,
  Minimize2,
  MoreHorizontal,
  Sparkles,
  SquareCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CONTAINER, SECTION_X, SPEAKER_TINT } from "@/components/heymoa/landing/shell";

/**
 * 히어로 아래 제품 화면. **실제로 눌린다** — 정보·전사·요약과 실시간 정리·내 에이전트가
 * 진짜 탭이고, 사건 범위 칩과 묶음 접기도 동작한다. 그림만 보여 주는 것보다 앱이 어떤지가
 * 훨씬 빨리 전해진다.
 *
 * **눌리는 것을 그리는 순간 진짜 탭이어야 한다.** `role="tablist"`와 방향키 이동
 * (roving tabIndex)까지 앱과 같게 둔다 — 버튼처럼 생겼는데 키보드로 못 쓰면 눌러 보라고
 * 해 놓고 못 누르게 막는 셈이다. 반대로 앱 화면을 **흉내만 내는** 것들(뒤로·전체화면·
 * 노트 메뉴·복사)은 여전히 `<span>`이다. 눌러도 할 일이 없는 것을 버튼으로 두면 탭 순회에
 * 빈 정거장이 늘 뿐이다.
 *
 * **좁은 화면과 넓은 화면이 다른 그림이다.** 아트보드 1440은 크림 매트 위에 창 하나를 얹고
 * 그 안을 전사와 레일로 나누지만, 390은 매트 안에 카드 **둘**을 세로로 쌓는다 — 390px에서
 * 창 하나를 반으로 가르면 양쪽 다 못 읽는다. 틀은 둘로 나뉘지만 **패널은 한 벌**이고
 * `compact`로 배율만 가른다.
 *
 * **패널 높이를 고정한다.** 탭마다 내용 길이가 달라서 그대로 두면 정보 탭을 누를 때 아래
 * 밴드가 통째로 올라온다. 앱도 고정 높이 뷰포트 안에서 스크롤하므로 이쪽이 실제에 가깝다.
 *
 * **구조는 시안이 아니라 실제 앱을 따른다**(`note-panel.tsx` · `context-rail.tsx` ·
 * `note-archive.tsx` · `note-details.tsx` · `note-summary.tsx`). 이 랜딩의 전제가
 * 「사실 대조판」이라, 목업이 앱과 어긋나면 목업이 틀린 것이다.
 *
 * **이 안의 글자는 삽화다.** 시각 `#b5a698`이나 9~11px 라벨은 페이지가 하는 말이 아니라
 * 앱 화면을 그린 그림이라 실제 앱의 크기와 색을 따른다. 페이지가 직접 하는 말(`--lp-body`
 * 이상)과 섞어 쓰지 않는다 — 대비 기준이 다르다.
 */

type Line = { at: string; who: string; text: string };

const TRANSCRIPT: Line[] = [
  { at: "00:00", who: "김민서", text: "이번 스프린트는 온보딩 이탈부터 봅니다. 지난주에 남긴 가설 두 개를 먼저 정리하죠." },
  { at: "00:14", who: "박지훈", text: "지난 회의에서 결제 화면 개편은 다음으로 미뤘습니다. 그 결정 그대로 갑니다." },
  { at: "00:31", who: "이서연", text: "저는 이번에 합류해서 그 맥락을 모릅니다. 왜 미뤘는지 다시 볼 수 있을까요?" },
  { at: "00:44", who: "김민서", text: "에이전트가 근거를 붙여 뒀어요. 오른쪽 정리에서 결정 항목을 펼치면 됩니다." },
  { at: "01:02", who: "정우재", text: "그럼 온보딩 이탈 로그 수집은 제가 맡겠습니다. 이번 주 목요일까지 초안 올릴게요." },
  { at: "01:19", who: "박지훈", text: "좋습니다. 그 작업은 Linear 이슈로 바로 내보내는 게 좋겠어요." },
  { at: "01:33", who: "이서연", text: "그 이슈에 이 회의 결정을 근거로 같이 붙여 주세요. 다음에 들어올 사람도 볼 수 있게요." },
  { at: "01:48", who: "김민서", text: "네. 승인 화면에서 확인하고 내보내겠습니다. 오늘 남길 건 여기까지입니다." },
];

/** 「회의 정보」 표. 라벨은 `note-details.tsx`의 `Fact`가 쓰는 것 그대로다. */
const FACTS: Array<[string, string]> = [
  ["진행자", "김민서 · 기록 제어 권한"],
  ["누적 기록 시간", "01:52"],
  ["공유 범위", "워크스페이스 멤버에게 공개"],
  ["생성", "2026년 9월 1일 오후 2:00"],
  ["최종 수정", "2026년 9월 1일 오후 2:02"],
];

/** 요약 탭. 라벨과 순서는 `lib/notes/analysis-sections.ts`가 정한 것 그대로다. */
const SUMMARY: Array<[string, Array<[string, string]>]> = [
  [
    "개요",
    [["온보딩 이탈을 이번 스프린트의 첫 기준선으로 잡고, 결제 화면 개편은 뒤로 미뤘습니다.", "00:00"]],
  ],
  [
    "액션 아이템",
    [
      ["온보딩 이탈 로그 수집 초안을 목요일까지 올립니다.", "01:02"],
      ["정리된 업무를 Linear 이슈로 내보냅니다.", "01:19"],
    ],
  ],
  ["결정", [["결제 화면 개편은 다음 스프린트로 미룹니다.", "00:14"]]],
];

/**
 * 레일 항목의 메타. **실제 컴포넌트가 붙이는 말만 쓴다** — 유형, 동작(새로 포착 · 내용 보강 ·
 * 내용 정정 · 철회 · 질문 해결), 상태(철회됨 · 답변됨 · 답 대기), 그리고 「수정 N」.
 * 「근거 3」이나 「승인 전」 같은 말은 코드에 없다.
 *
 * `outcome`은 범위 칩이 거르는 값이고, `metaSm`은 좁은 카드용이라 유형을 뺀다.
 */
type Outcome = "결론" | "논의 중" | "참고";
type Item = { title: string; at: string; more: number; meta: string; metaSm: string; outcome: Outcome };

/**
 * 아이콘은 `lib/notes/context-candidates/presentation.ts`의 `CONTEXT_KIND_ICON` 그대로다 —
 * 결정 `CircleCheck` · 할 일 `SquareCheck` · 질문 `CircleQuestionMark`. 묶음 머리와 카드가
 * **같은 아이콘**을 쓴다(앱이 그렇다).
 */
type Group = { kind: string; icon: LucideIcon; items: Item[] };

const GROUPS: Group[] = [
  {
    kind: "결정",
    icon: CircleCheck,
    items: [
      { title: "결제 화면 개편은 다음 스프린트로 미룬다", at: "00:14", more: 3, meta: "결정 · 내용 보강", metaSm: "내용 보강", outcome: "결론" },
      { title: "온보딩 이탈 지표를 이번 주 기준선으로 삼는다", at: "00:52", more: 2, meta: "결정 · 수정 1", metaSm: "수정 1", outcome: "결론" },
    ],
  },
  {
    kind: "할 일",
    icon: SquareCheck,
    items: [
      { title: "온보딩 이탈 로그 수집 초안 · 목요일", at: "01:02", more: 2, meta: "할 일", metaSm: "", outcome: "논의 중" },
      { title: "카드 결제 실패 재시도 정책 정하기", at: "01:19", more: 1, meta: "할 일 · 수정 1", metaSm: "수정 1", outcome: "논의 중" },
    ],
  },
  {
    kind: "질문",
    icon: CircleQuestionMark,
    items: [
      { title: "결제 화면 개편을 미룬 이유는 무엇인가", at: "00:31", more: 2, meta: "질문 · 답변됨 · 수정 1", metaSm: "답변됨 · 수정 1", outcome: "참고" },
    ],
  },
];

const OUTCOMES = ["전체", "결론", "논의 중", "참고"] as const;
type Scope = (typeof OUTCOMES)[number];

const NOTE_TABS = ["정보", "전사", "요약"] as const;
type NoteTab = (typeof NOTE_TABS)[number];

const RAIL_TABS = ["실시간 정리", "내 에이전트"] as const;
type RailTab = (typeof RAIL_TABS)[number];

export function ProductShot() {
  /**
   * 창 하나가 상태를 다 갖는다. 좁은 화면의 카드 둘은 같은 상태를 나눠 쓰므로, 폭이
   * 바뀌어도 보던 탭이 그대로 남는다.
   */
  const [noteTab, setNoteTab] = useState<NoteTab>("전사");
  const [railTab, setRailTab] = useState<RailTab>("실시간 정리");
  const [scope, setScope] = useState<Scope>("전체");
  /** 접힌 묶음. 기본은 다 펼침이라 **닫힌 것만** 담는다. */
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const uid = useId();

  const toggleGroup = (kind: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(kind)) next.add(kind);
      return next;
    });

  const shared = { scope, setScope, closed, toggleGroup, uid };

  return (
    <section className={`${SECTION_X} flex flex-col items-center pt-9 pb-16 lg:pt-14 lg:pb-25`}>
      {/* 좁은 매트 — 카드 둘 */}
      <div className="box-border flex w-full flex-col gap-2.5 rounded-[20px] bg-[var(--lp-cream)] p-3 lg:hidden">
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-[var(--lp-rule-soft)] px-[13px] py-[11px]">
            <StatusChip compact />
            <span className="min-w-0 flex-1 truncate break-keep text-[14px] font-bold text-[var(--lp-ink)]">
              3차 스프린트 킥오프
            </span>
          </div>
          <NoteTabList value={noteTab} onChange={setNoteTab} uid={uid} compact />
          <NotePanels tab={noteTab} uid={uid} compact />
        </div>

        <div className={CARD}>
          <RailTabList value={railTab} onChange={setRailTab} uid={uid} compact />
          <RailPanels tab={railTab} compact {...shared} />
        </div>
      </div>

      {/* 넓은 매트 — 창 하나.
          `zoom`으로 줄인다. 최대 폭만 줄이면 안쪽 글이 다시 흘러 세로가 같은 비율로 안 줄고,
          `scale`은 레이아웃 상자를 그대로 둬서 아래에 빈 자리가 남는다. `zoom`은 상자까지
          같이 줄어서 가로·세로가 정확히 같은 비율로 작아진다. */}
      <div
        className={`${CONTAINER} box-border hidden rounded-[24px] border border-[var(--lp-rule)] bg-[var(--lp-cream)] p-6 lg:block lg:[zoom:0.96]`}
      >
        <div className="overflow-hidden rounded-[14px] border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_10px_28px_-6px_#33231a1f]">
          <div className="flex items-stretch">
            {/* 상단바는 **전사 기둥 안**에 산다 — 창 전체를 가로지르지 않는다
                (`note-panel.tsx`의 `h-14` 바). 레일은 제 헤더를 따로 이고 옆에 선다. */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--lp-rule-soft)] px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <ChevronLeft aria-hidden className="size-[17px] shrink-0 text-[var(--lp-body)]" />
                  <Minimize2 aria-hidden className="size-[15px] shrink-0 text-[var(--lp-faint)]" />
                  <StatusChip />
                  <span className="truncate break-keep text-[14px] font-semibold text-[var(--lp-ink)]">
                    3차 스프린트 킥오프
                  </span>
                </div>
                <NoteTabList value={noteTab} onChange={setNoteTab} uid={uid} />
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--lp-rule)]">
                  <MoreHorizontal aria-hidden className="size-4 text-[#8a7a6d]" />
                </span>
              </div>
              <NotePanels tab={noteTab} uid={uid} />
            </div>

            <div className="box-border flex w-[360px] shrink-0 flex-col border-l border-[var(--lp-rule-soft)] bg-[var(--lp-canvas)]">
              {/* 레일 헤더도 h-14 — 상단바와 바닥선이 맞아야 두 기둥이 한 창으로 읽힌다. */}
              <RailTabList value={railTab} onChange={setRailTab} uid={uid} />
              <RailPanels tab={railTab} {...shared} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const CARD =
  "box-border rounded-[14px] border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_2px_8px_#33231a12]";

function StatusChip({ compact }: { compact?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lp-rule-soft)] ${compact ? "px-2 py-[3px]" : "px-[9px] py-1"}`}
    >
      <span
        aria-hidden
        className={`block shrink-0 rounded-full bg-[#8a7a6d] ${compact ? "size-[5px]" : "size-1.5"}`}
      />
      <span className={`font-semibold text-[var(--lp-body)] ${compact ? "text-[9.5px]" : "text-[11px]"}`}>
        종료됨
      </span>
    </span>
  );
}

/* ── 탭 ─────────────────────────────────────────────────────────────────── */

/**
 * 방향키로 옮기면 선택도 함께 바뀐다(automatic activation). 패널이 전부 마운트된 채
 * 숨겨져 있어 전환 비용이 없으므로, 화살표만 눌러도 내용이 따라오는 쪽이 빠르다 —
 * `note-agent-rail.tsx`가 같은 판단을 한다.
 */
function useTabKeys<T extends string>(tabs: readonly T[], value: T, onChange: (t: T) => void) {
  return (event: React.KeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1;
    const at = tabs.indexOf(value);
    const next =
      event.key === "ArrowRight" ? (at >= last ? 0 : at + 1)
      : event.key === "ArrowLeft" ? (at <= 0 ? last : at - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(tabs[next]);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };
}

/** 앱과 같은 **밑줄 탭**이다 — 알약이 아니다(`note-panel.tsx`의 `TabsList variant="line"`). */
function NoteTabList({
  value,
  onChange,
  uid,
  compact,
}: {
  value: NoteTab;
  onChange: (t: NoteTab) => void;
  uid: string;
  compact?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="노트 화면 미리 보기"
      onKeyDown={useTabKeys(NOTE_TABS, value, onChange)}
      className={
        compact
          ? "flex items-center gap-4 border-b border-[var(--lp-rule-soft)] px-[13px]"
          : "flex h-14 shrink-0 items-center gap-5"
      }
    >
      {NOTE_TABS.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          id={`${uid}-note-${t}`}
          aria-controls={`${uid}-note-panel`}
          aria-selected={t === value}
          tabIndex={t === value ? 0 : -1}
          onClick={() => onChange(t)}
          // `px-1`은 두 글자 라벨(「정보」)의 과녁을 24px 위로 올린다 — 밑줄이 그만큼
          // 넓어지지만 앱의 밑줄도 라벨 상자를 따른다.
          className={`flex items-center justify-center border-b-2 px-1 transition-colors ${
            compact ? "h-8 text-[10.5px]" : "h-14 text-[13px]"
          } ${
            t === value
              ? "border-[var(--lp-ink)] font-semibold text-[var(--lp-ink)]"
              : "border-transparent font-medium text-[#8a7a6d] hover:text-[var(--lp-ink)]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/** 레일 탭만 알약이다(`note-agent-rail.tsx`의 `RailTabButton`). */
function RailTabList({
  value,
  onChange,
  uid,
  compact,
}: {
  value: RailTab;
  onChange: (t: RailTab) => void;
  uid: string;
  compact?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="에이전트 미리 보기"
      onKeyDown={useTabKeys(RAIL_TABS, value, onChange)}
      className={
        compact
          ? "flex items-center gap-1 border-b border-[var(--lp-rule-soft)] px-[13px] pt-3 pb-2.5"
          : "flex h-14 shrink-0 items-center gap-1 border-b border-[var(--lp-rule-soft)] px-3"
      }
    >
      {RAIL_TABS.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          id={`${uid}-rail-${t}`}
          aria-controls={`${uid}-rail-panel`}
          aria-selected={t === value}
          tabIndex={t === value ? 0 : -1}
          onClick={() => onChange(t)}
          className={`inline-flex items-center rounded-lg transition-colors ${
            compact ? "h-7 px-2.5 text-[10.5px]" : "h-8 px-2.5 text-[11.5px]"
          } ${
            t === value
              ? "bg-[var(--lp-rule-soft)] font-semibold text-[var(--lp-ink)]"
              : "text-[var(--lp-body)] hover:bg-[var(--lp-rule-soft)]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ── 노트 패널 ──────────────────────────────────────────────────────────── */

/**
 * 높이를 고정한다 — 탭마다 길이가 달라서 그대로 두면 정보 탭을 누를 때 아래 밴드가
 * 통째로 올라온다. 앱도 고정 높이 뷰포트 안에서 스크롤한다.
 */
function NotePanels({ tab, uid, compact }: { tab: NoteTab; uid: string; compact?: boolean }) {
  return (
    <div
      role="tabpanel"
      id={`${uid}-note-panel`}
      aria-labelledby={`${uid}-note-${tab}`}
      // 가장 긴 패널(넓은 화면은 전사, 좁은 화면도 전사)에 맞춘 값이다. 짧은 탭은 아래가
      // 비지만, 앱도 고정 높이 뷰포트라 그쪽이 실제에 가깝다.
      className={`overflow-hidden ${compact ? "h-[372px]" : "h-[676px]"}`}
    >
      {/* `key`로 다시 마운트시켜 탭마다 새로 들게 한다 — 전이로는 같은 노드가 남아
          안 걸린다. */}
      <div key={tab} data-panel>
        {tab === "정보" ? <DetailsPanel compact={compact} /> : null}
        {tab === "전사" ? <TranscriptPanel compact={compact} /> : null}
        {tab === "요약" ? <SummaryPanel compact={compact} /> : null}
      </div>
    </div>
  );
}

function DetailsPanel({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "px-[13px] py-3.5" : "px-5 py-5"}>
      <p className={`m-0 mb-2.5 font-semibold text-[var(--lp-ink)] ${compact ? "text-[11.5px]" : "text-[13px]"}`}>
        회의 정보
      </p>
      <dl className="m-0 flex flex-col">
        {FACTS.map(([k, v]) => (
          <div
            key={k}
            className={`flex gap-3 border-b border-[var(--lp-rule-soft)] ${compact ? "py-2" : "py-2.5"}`}
          >
            <dt
              className={`shrink-0 text-[var(--lp-body)] ${compact ? "w-[76px] text-[10px]" : "w-[104px] text-[11.5px]"}`}
            >
              {k}
            </dt>
            <dd
              className={`m-0 min-w-0 break-keep text-[var(--lp-ink)] ${compact ? "text-[10.5px]" : "text-[12px]"}`}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * 전사 줄은 **두 칸 격자**다 — 왼쪽에 시각, 오른쪽에 화자 한 줄과 그 아래 본문
 * (`note-archive.tsx`의 `grid-cols-[66px_1fr]`). 화자 이름을 본문 옆에 세우지 않는다.
 *
 * 크기는 앱의 0.85배다. 실제 값(본문 15/28)을 그대로 쓰면 여덟 줄이 창 높이를 넘는다.
 */
function TranscriptPanel({ compact }: { compact?: boolean }) {
  const lines = compact ? TRANSCRIPT.slice(0, 4) : TRANSCRIPT;
  return (
    <div className={compact ? "px-[13px] pt-2.5 pb-3" : "px-5 pt-4 pb-5"}>
      <div className="flex justify-end">
        <span
          className={`flex items-center gap-1.5 rounded-lg border border-[var(--lp-rule)] ${compact ? "px-[9px] py-1" : "px-2.5 py-[5px]"}`}
        >
          <Copy aria-hidden className={compact ? "size-2.5 text-[#8a7a6d]" : "size-3 text-[#8a7a6d]"} />
          <span className={`font-medium text-[var(--lp-body)] ${compact ? "text-[9.5px]" : "text-[11px]"}`}>
            복사
          </span>
        </span>
      </div>
      <ul className={`m-0 list-none p-0 ${compact ? "" : "mt-1"}`}>
        {lines.map((l, i) => (
          <li
            key={l.at}
            data-stagger
            style={{ "--i": i } as React.CSSProperties}
            className={`grid border-b border-[var(--lp-rule-soft)] ${
              compact ? "grid-cols-[34px_1fr] gap-2.5 py-2.5" : "grid-cols-[56px_1fr] gap-5 py-3.5"
            }`}
          >
            <span
              className={`font-mono tabular-nums text-[var(--lp-faint)] ${compact ? "text-[9.5px]" : "pt-0.5 text-[10px]"}`}
            >
              {l.at}
            </span>
            <div className="min-w-0">
              <span
                className={`inline-flex items-center gap-1.5 font-medium text-[var(--lp-muted)] ${compact ? "text-[10px]" : "text-[11.5px]"}`}
              >
                <span
                  aria-hidden
                  style={{ background: SPEAKER_TINT[l.who] }}
                  className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
                    compact ? "size-[15px] text-[8px]" : "size-[17px] text-[9px]"
                  }`}
                >
                  {l.who.slice(0, 1)}
                </span>
                {l.who}
              </span>
              <p
                className={`m-0 mt-0.5 break-keep text-[var(--lp-ink)] ${compact ? "text-[11.5px] leading-[1.65]" : "text-[13px] leading-[1.75]"}`}
              >
                {l.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 개요 → 액션 아이템 → 결정을 위에서 아래로. 항목 뒤에 근거 마커가 붙는다. */
function SummaryPanel({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col ${compact ? "gap-5 px-[13px] py-3.5" : "gap-8 px-5 py-5"}`}>
      {SUMMARY.map(([label, items]) => (
        <section key={label}>
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--lp-rule-strong)] pb-2">
            <p
              className={`m-0 font-serif font-light tracking-[-0.025em] text-[var(--lp-ink)] ${compact ? "text-[15px]" : "text-[18px]"}`}
            >
              {label}
            </p>
            <span
              className={`font-mono tabular-nums text-[var(--lp-faint)] ${compact ? "text-[9.5px]" : "text-[11px]"}`}
            >
              {items.length}
            </span>
          </div>
          <ul className={`m-0 list-none p-0 ${compact ? "mt-3 space-y-3" : "mt-4 space-y-4"}`}>
            {items.map(([text, at]) => (
              <li key={text}>
                <p
                  className={`m-0 break-keep text-[var(--lp-ink)] ${compact ? "text-[11.5px] leading-[1.6]" : "text-[13px] leading-[1.7]"}`}
                >
                  {text}{" "}
                  {/* 근거 마커는 문장 **바로 뒤**에 붙는다 — 오른쪽 끝으로 밀면 무엇의
                      근거인지 안 보인다. */}
                  <span
                    className={`ml-0.5 inline-flex items-center gap-1 rounded-full border border-[var(--lp-rule)] bg-[var(--lp-canvas)] px-1.5 align-middle font-mono tabular-nums text-[var(--lp-muted)] ${compact ? "py-px text-[9px]" : "py-0.5 text-[9.5px]"}`}
                  >
                    {at}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ── 레일 패널 ──────────────────────────────────────────────────────────── */

type RailShared = {
  scope: Scope;
  setScope: (s: Scope) => void;
  closed: ReadonlySet<string>;
  toggleGroup: (kind: string) => void;
  uid: string;
};

function RailPanels({
  tab,
  compact,
  ...shared
}: RailShared & { tab: RailTab; compact?: boolean }) {
  return (
    <div
      role="tabpanel"
      id={`${shared.uid}-rail-panel`}
      aria-labelledby={`${shared.uid}-rail-${tab}`}
      // 넓은 화면은 노트 쪽과 같은 값이라 두 기둥의 바닥선이 맞는다.
      className={`overflow-hidden ${compact ? "h-[532px]" : "h-[676px]"}`}
    >
      <div key={tab} data-panel>
        {tab === "실시간 정리" ? <ContextPanel compact={compact} {...shared} /> : null}
        {tab === "내 에이전트" ? <AgentPanel compact={compact} /> : null}
      </div>
    </div>
  );
}

function ContextPanel({
  compact,
  scope,
  setScope,
  closed,
  toggleGroup,
  uid,
}: RailShared & { compact?: boolean }) {
  const count = (s: Scope) =>
    GROUPS.flatMap((g) => g.items).filter((i) => s === "전체" || i.outcome === s).length;
  const visible = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => scope === "전체" || i.outcome === scope),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className={`flex flex-col ${compact ? "gap-3 px-[13px] pt-3 pb-3.5" : "gap-[18px] px-4 pt-[22px] pb-5"}`}
    >
      <div className="flex items-center gap-2.5">
        {compact ? <Bot aria-hidden className="size-[13px] shrink-0 text-[var(--lp-accent)]" /> : null}
        <span
          className={`font-semibold tracking-[-0.3px] text-[var(--lp-ink)] ${compact ? "text-[14px]" : "text-[17px] leading-none"}`}
        >
          사건 흐름
        </span>
        <span
          className={`ml-auto shrink-0 rounded-full border border-[var(--lp-rule)] bg-[var(--lp-card)] tabular-nums text-[var(--lp-muted)] ${compact ? "px-2 py-px text-[10px]" : "px-[9px] py-[3px] text-[10.5px]"}`}
        >
          지금까지 5건
        </span>
      </div>

      <p
        className={`m-0 break-keep leading-[1.5] text-[#8a7a6d] ${compact ? "-mt-1.5 text-[10.5px]" : "-mt-2 text-[11.5px]"}`}
      >
        이 회의에서 남길 만한 변화만 기록했습니다.
      </p>

      {/* 범위 칩. `aria-pressed`로 눌린 상태를 말한다 — 라벨과 개수가 다른 요소라
          그냥 두면 「전체5」로 읽힌다. */}
      <div role="group" aria-label="사건 범위로 좁히기" className="flex flex-wrap gap-1.5">
        {OUTCOMES.map((s) => {
          const on = s === scope;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              aria-label={`${s} ${count(s)}`}
              onClick={() => setScope(s)}
              className={`flex min-h-6 shrink-0 items-center gap-[5px] rounded-full transition-colors ${
                compact ? "px-2 text-[10px]" : "px-[11px] text-[11.5px]"
              } ${
                on
                  ? "bg-[var(--lp-dark)] font-semibold text-[var(--lp-on-dark)] shadow-[0_1px_3px_#33231a18]"
                  : "border border-[var(--lp-rule)] font-medium text-[var(--lp-muted)] hover:text-[var(--lp-ink)]"
              }`}
            >
              {s}
              <span
                className={`font-mono tabular-nums ${compact ? "text-[9.5px]" : "text-[10.5px]"} ${on ? "text-[var(--lp-on-dark-soft)]" : "text-[var(--lp-faint)]"}`}
              >
                {count(s)}
              </span>
            </button>
          );
        })}
      </div>

      {visible.map(({ kind, icon: Icon, items }) => {
        const open = !closed.has(kind);
        const listId = `${uid}-group-${kind}`;
        return (
          <div key={kind} className={`flex flex-col ${compact ? "gap-2" : "gap-[9px]"}`}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => toggleGroup(kind)}
              className={`group flex min-h-6 w-full items-center text-left ${compact ? "gap-2" : "gap-[9px] px-0.5"}`}
            >
              <Icon aria-hidden className="size-[15px] shrink-0 text-[var(--lp-body)]" />
              <span
                className={`font-semibold text-[var(--lp-ink)] ${compact ? "text-[11.5px]" : "text-[13px]"}`}
              >
                {kind}
              </span>
              <span aria-hidden className="block h-px min-w-0 flex-1 bg-[var(--lp-rule)]" />
              <span
                className={`shrink-0 font-mono tabular-nums text-[var(--lp-faint)] ${compact ? "text-[10px]" : "text-[10.5px]"}`}
              >
                {items.length}
              </span>
              <ChevronDown
                aria-hidden
                className={`size-3.5 shrink-0 transition-[transform,color] group-hover:text-[var(--lp-ink)] ${
                  open ? "rotate-180 text-[var(--lp-muted)]" : "text-[var(--lp-faint)]"
                }`}
              />
            </button>
            {open ? (
              <ul id={listId} className={`m-0 flex list-none flex-col p-0 ${compact ? "gap-[7px]" : "gap-2"}`}>
                {items.map((it) => (
                  <li
                    key={it.title}
                    className={`flex rounded-xl border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_1px_2px_#33231a10] ${
                      compact ? "gap-2.5 px-3 py-2.5" : "gap-[11px] px-3.5 py-[13px]"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex shrink-0 items-center justify-center rounded-lg border border-[var(--lp-rule)] bg-[var(--lp-canvas)] ${compact ? "size-[22px]" : "size-[26px]"}`}
                    >
                      <Icon className={compact ? "size-3 text-[var(--lp-body)]" : "size-3.5 text-[var(--lp-body)]"} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start gap-2.5">
                        <p
                          className={`m-0 min-w-0 flex-1 break-keep font-medium leading-[1.45] tracking-[-0.1px] text-[var(--lp-ink)] ${compact ? "text-[11px]" : "text-[12.5px]"}`}
                        >
                          {it.title}
                        </p>
                        <span className="flex shrink-0 items-center gap-1.5 pt-px">
                          <span
                            className={`font-mono tabular-nums text-[var(--lp-faint)] ${compact ? "text-[9.5px]" : "text-[10px]"}`}
                          >
                            {it.at}
                          </span>
                          <span
                            className={`font-mono tabular-nums text-[#8a7a6d] ${compact ? "text-[9.5px]" : "text-[10px]"}`}
                          >
                            +{it.more}
                          </span>
                          {compact ? null : (
                            <ChevronDown aria-hidden className="size-3 text-[var(--lp-faint)]" />
                          )}
                        </span>
                      </div>
                      {(compact ? it.metaSm : it.meta) ? (
                        <p className={`m-0 text-[#8a7a6d] ${compact ? "text-[10px]" : "text-[11px]"}`}>
                          {compact ? it.metaSm : it.meta}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 개인 챗. **범위 한 줄이 이 화면의 요점이다** — 남의 눈에 안 보인다는 사실은 화면
 * 어디에도 다시 안 나온다(`note-agent-rail.tsx`).
 */
function AgentPanel({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex h-full flex-col ${compact ? "px-[13px] pb-3.5" : "px-3 pb-4"}`}>
      <p
        className={`m-0 font-medium text-[var(--lp-body)] ${compact ? "px-0 py-1.5 text-[10px]" : "px-1 py-2 text-[11px]"}`}
      >
        나만 보는 대화 · 현재 회의 범위
      </p>

      <div className={`flex flex-col ${compact ? "gap-2.5 pt-1" : "gap-3 pt-2"}`}>
        <div
          className={`max-w-[82%] self-end rounded-[12px_12px_4px_12px] bg-[var(--lp-rule-soft)] ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}
        >
          <span
            className={`break-keep leading-[1.5] text-[var(--lp-ink)] ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}
          >
            결제 화면 개편은 왜 미뤘나요?
          </span>
        </div>

        <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
          <div className="flex items-center gap-1.5">
            <Sparkles aria-hidden className="size-3 shrink-0 text-[var(--lp-accent)]" />
            <span
              className={`font-semibold text-[var(--lp-accent)] ${compact ? "text-[10px]" : "text-[10.5px]"}`}
            >
              HeyMoa
            </span>
          </div>
          <p
            className={`m-0 break-keep leading-[1.65] text-[var(--lp-body)] ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}
          >
            온보딩 이탈 지표를 먼저 보기로 해서 다음 스프린트로 미뤘습니다. 2차 회의에서
            정해진 결정입니다.
          </p>
          <div className="flex flex-wrap items-center gap-[5px]">
            {["2차 회의", "이번 회의"].map((chip) => (
              <span
                key={chip}
                className={`rounded-full bg-[var(--lp-rule-soft)] font-medium text-[var(--lp-body)] ${compact ? "px-2 py-[3px] text-[9.5px]" : "px-[7px] py-[3px] text-[9.5px]"}`}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`mt-auto flex items-center gap-[7px] rounded-full border border-[var(--lp-rule-strong)] ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}
      >
        <span className={`text-[var(--lp-faint)] ${compact ? "text-[10.5px]" : "text-[11px]"}`}>
          이 회의에 대해 물어보기
        </span>
        <span className="flex-1" />
        <ArrowUp aria-hidden className="size-3 shrink-0 text-[#8a7a6d]" />
      </div>
    </div>
  );
}
