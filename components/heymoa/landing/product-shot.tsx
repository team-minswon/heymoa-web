"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleStop,
  Copy,
  Loader2,
  Minimize2,
  MoreHorizontal,
  Sparkles,
  UserPlus,
} from "lucide-react";

import {
  CONTAINER,
  SECTION_X,
  SPEAKER_LABEL_TINT,
  SPEAKER_TINT,
} from "@/components/heymoa/landing/shell";
import {
  ASKS,
  BASE_EVENTS,
  BASE_LINES,
  CONTEXT,
  CONTEXT_ICON,
  CONTEXT_KINDS,
  NOTE_TABS,
  OUTCOMES,
  RAIL_TABS,
  SPEAKER_LABEL,
  SUMMARY,
  THINKING,
  useDemo,
  useInView,
  type Demo,
  type Line,
  type NoteTab,
  type RailTab,
  type Scope,
} from "@/components/heymoa/landing/use-demo";

/**
 * 히어로 아래 제품 화면. **혼자 한 바퀴 돈다** — 말이 전사로 받아 적히고, 사건 흐름에
 * 쌓이고, 에이전트가 답하고, 회의를 끝내면 요약이 나온다. 대본과 시간은
 * `use-demo.ts`에 있고 여기는 그 상태를 그리기만 한다.
 *
 * **그리고 실제로 눌린다.** 정보·전사·요약과 실시간 정리·내 에이전트가 진짜 탭이고, 사건
 * 범위 칩과 묶음 접기, 예시 질문이 다 동작한다. 누르면 **그 기둥의 탭만** 그
 * 자리에 못 박히고 대본은 계속 돈다 — 눌러 보라고 해 놓고 화면이 딴 데로 가도 안 되지만,
 * 거기서 대본까지 끊으면 보여 주려던 것이 통째로 사라진다. **장면이 바뀌는 이동(질의 ·
 * 요약)에는 같이 간다** — 고정이 그것까지 막으면 이번엔 장면 하나를 못 본다.
 * 한 바퀴가 끝나면 스스로 처음으로 돌아가고, 그때 고정이 풀린다. 화면 밖으로 나가면
 * 대본이 쉰다.
 *
 * **눌리는 것을 그리는 순간 진짜 탭이어야 한다.** `role="tablist"`와 방향키 이동
 * (roving tabIndex)까지 앱과 같게 둔다. 반대로 앱 화면을 **흉내만 내는** 것들(뒤로·
 * 전체화면·노트 메뉴·복사)은 여전히 `<span>`이다 — 눌러도 할 일이 없는 것을 버튼으로 두면
 * 탭 순회에 빈 정거장이 늘 뿐이다.
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
 * `note-archive.tsx` · `note-details.tsx` · `note-summary.tsx` · `meeting-controls.tsx`).
 * 이 랜딩의 전제가 「사실 대조판」이라, 목업이 앱과 어긋나면 목업이 틀린 것이다.
 *
 * **이 안의 글자는 삽화다.** 시각 `#b5a698`이나 9~11px 라벨은 페이지가 하는 말이 아니라
 * 앱 화면을 그린 그림이라 실제 앱의 크기와 색을 따른다. 페이지가 직접 하는 말(`--lp-body`
 * 이상)과 섞어 쓰지 않는다 — 대비 기준이 다르다.
 */

export function ProductShot() {
  /**
   * 창 하나가 상태를 다 갖는다. 좁은 화면의 카드 둘은 같은 상태를 나눠 쓰므로, 폭이
   * 바뀌어도 보던 탭이 그대로 남는다.
   */
  const [visible, seen, watch] = useInView();
  const demo = useDemo({ visible, seen });
  const [scope, setRawScope] = useState<Scope>("전체");
  /** 접힌 묶음. 기본은 다 펼침이라 **닫힌 것만** 담는다. */
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const uid = useId();

  // 범위 칩과 묶음 접기는 레일을 만진 것이다 — 걸러 보는 중에 대본이 탭을 옮기면 방금
  // 좁힌 목록이 통째로 사라진다. 카드가 계속 쌓이는 것은 그대로 둔다.
  const setScope = (s: Scope) => {
    demo.pinRail();
    setRawScope(s);
  };
  const toggleGroup = (kind: string) => {
    demo.pinRail();
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(kind)) next.add(kind);
      return next;
    });
  };

  /**
   * **좁은 화면용과 넓은 화면용이 둘 다 마운트된다**(CSS로 하나만 보인다). 같은 `uid`를
   * 주면 탭과 패널의 `id`가 통째로 겹쳐서, `aria-controls`·`aria-labelledby`가 DOM에서
   * 먼저 나온 숨은 쪽을 가리킨다 — 보이는 탭의 관계가 끊긴다. 접두사를 가른다.
   */
  const smUid = `${uid}-sm`;
  const lgUid = `${uid}-lg`;

  // `uid`는 여기 안 담는다 — 두 벌이 서로 다른 값을 써야 해서 호출부가 직접 준다.
  const shared = { scope, setScope, closed, toggleGroup, demo };

  return (
    <section
      ref={watch}
      className={`${SECTION_X} flex flex-col items-center pt-9 pb-16 lg:pt-14 lg:pb-25`}
    >
      {/* 좁은 매트 — 카드 둘 */}
      <div className="box-border flex w-full flex-col gap-2.5 rounded-[20px] bg-[var(--lp-cream)] p-3 lg:hidden">
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-[var(--lp-rule-soft)] px-[13px] py-[11px]">
            <StatusChip ended={demo.ended} compact />
            <span className="min-w-0 flex-1 truncate break-keep text-[14px] font-bold text-[var(--lp-ink)]">
              3차 스프린트 킥오프
            </span>
            <EndButton pressing={demo.pressing} gone={demo.ended} compact />
          </div>
          <NoteTabList
            value={demo.noteTab}
            onChange={demo.setNoteTab}
            uid={smUid}
            compact
          />
          <NotePanels demo={demo} uid={smUid} compact />
        </div>

        <div className={CARD}>
          <RailTabList
            value={demo.railTab}
            onChange={demo.setRailTab}
            uid={smUid}
            compact
          />
          <RailPanels compact {...shared} uid={smUid} />
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
                  <ChevronLeft
                    aria-hidden
                    className="size-[17px] shrink-0 text-[var(--lp-body)]"
                  />
                  <Minimize2
                    aria-hidden
                    className="size-[15px] shrink-0 text-[var(--lp-faint)]"
                  />
                  <StatusChip ended={demo.ended} />
                  <span className="truncate break-keep text-[14px] font-semibold text-[var(--lp-ink)]">
                    3차 스프린트 킥오프
                  </span>
                </div>
                <EndButton pressing={demo.pressing} gone={demo.ended} />
                <NoteTabList
                  value={demo.noteTab}
                  onChange={demo.setNoteTab}
                  uid={lgUid}
                />
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--lp-rule)]">
                  <MoreHorizontal
                    aria-hidden
                    className="size-4 text-[#8a7a6d]"
                  />
                </span>
              </div>
              <NotePanels demo={demo} uid={lgUid} />
            </div>

            <div className="box-border flex w-[360px] shrink-0 flex-col border-l border-[var(--lp-rule-soft)] bg-[var(--lp-canvas)]">
              {/* 레일 헤더도 h-14 — 상단바와 바닥선이 맞아야 두 기둥이 한 창으로 읽힌다. */}
              <RailTabList
                value={demo.railTab}
                onChange={demo.setRailTab}
                uid={lgUid}
              />
              <RailPanels {...shared} uid={lgUid} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const CARD =
  "box-border rounded-[14px] border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_2px_8px_#33231a12]";

/**
 * 회의 상태 칩. **기록 중만 붉다** — 종료는 사건이 아니라 상태다
 * (`meeting-controls.tsx`의 `MeetingStatusChip`). 라벨도 앱의 `MEETING_STATUS_LABEL`
 * 그대로다.
 */
function StatusChip({ ended, compact }: { ended: boolean; compact?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lp-rule-soft)] ${compact ? "px-2 py-[3px]" : "px-[9px] py-1"}`}
    >
      <span
        aria-hidden
        className={`block shrink-0 rounded-full ${ended ? "bg-[#8a7a6d]" : "bg-[var(--lp-rec)]"} ${compact ? "size-[5px]" : "size-1.5"}`}
      />
      <span
        className={`font-semibold ${ended ? "text-[var(--lp-body)]" : "text-[var(--lp-rec-ink)]"} ${compact ? "text-[9.5px]" : "text-[11px]"}`}
      >
        {ended ? "종료됨" : "기록 중"}
      </span>
    </span>
  );
}

/**
 * 회의 종료. 앱의 Meeting Bar는 **이 버튼 하나뿐이다**(`meeting-controls.tsx` —
 * h32 · r8 · destructive 테두리와 글자 · 12px).
 *
 * **그림이다.** 한때 진짜로 눌렸는데, 누르는 순간 기록 중이던 회의가 종료로 확 넘어가서
 * 「내가 뭘 부순 건가」로 읽혔다 — 앱에서는 다이얼로그가 한 번 더 묻고 되돌릴 수 없는
 * 일이라는 것을 말해 주지만(`meeting-end-dialog.tsx`), 랜딩에서 그 확인창까지 그리면
 * 이 자리가 회의 종료를 배우는 화면이 되어 버린다. 대본이 제때 누른다.
 *
 * **누르는 순간을 보여 준다.** 버튼이 그냥 사라지고 칩만 바뀌면 「누가 눌렀다」는 순간이
 * 화면 어디에도 없다. 이 대목만 다른 대목보다 느리다(1.4초) — 손이 닿고, 눌러 들어가고,
 * 머물고, 떼는 네 동작이 다 보인 다음에 회의가 끝나며 자리를 접는다.
 *
 * **끝나도 언마운트하지 않는다.** 지우면 85px짜리 버튼이 한 프레임에 없어진다 — 옆 자리가
 * 밀리지는 않지만(제목이 `flex-1`이라 그 폭을 먹는다) 팝으로 읽힌다. 폭을 접어서 내보내면
 * 눌러서 사라진 것으로 읽힌다.
 */
function EndButton({
  pressing,
  gone,
  compact,
}: {
  pressing: boolean;
  gone: boolean;
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden={gone || undefined}
      data-pressing={pressing ? "" : undefined}
      data-gone={gone ? "" : undefined}
      className={`lp-end inline-flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-[var(--lp-rec)] font-medium text-[var(--lp-rec-ink)] ${
        compact ? "h-6 px-1.5 text-[10px]" : "h-8 px-2.5 text-[12px]"
      }`}
    >
      <CircleStop aria-hidden className={compact ? "size-3" : "size-4"} />
      회의 종료
    </span>
  );
}

/* ── 탭 ─────────────────────────────────────────────────────────────────── */

/**
 * 방향키로 옮기면 선택도 함께 바뀐다(automatic activation). 패널이 전부 마운트된 채
 * 숨겨져 있어 전환 비용이 없으므로, 화살표만 눌러도 내용이 따라오는 쪽이 빠르다 —
 * `note-agent-rail.tsx`가 같은 판단을 한다.
 */
function useTabKeys<T extends string>(
  tabs: readonly T[],
  value: T,
  onChange: (t: T) => void
) {
  return (event: React.KeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1;
    const at = tabs.indexOf(value);
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
          id={`${uid}-note-${NOTE_TABS.indexOf(t)}`}
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
          id={`${uid}-rail-${RAIL_TABS.indexOf(t)}`}
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
function NotePanels({
  demo,
  uid,
  compact,
}: {
  demo: Demo;
  uid: string;
  compact?: boolean;
}) {
  const tab = demo.noteTab;
  return (
    <div
      role="tabpanel"
      id={`${uid}-note-panel`}
      aria-labelledby={`${uid}-note-${NOTE_TABS.indexOf(tab)}`}
      // 가장 긴 패널(넓은 화면은 전사, 좁은 화면도 전사)에 맞춘 값이다. 짧은 탭은 아래가
      // 비지만, 앱도 고정 높이 뷰포트라 그쪽이 실제에 가깝다.
      className={`overflow-hidden ${compact ? "h-[372px]" : "h-[676px]"}`}
    >
      {/* `key`로 다시 마운트시켜 탭마다 새로 들게 한다 — 전이로는 같은 노드가 남아
          안 걸린다. */}
      <div key={tab} data-panel className="h-full">
        {tab === "정보" ? (
          <DetailsPanel
            ended={demo.ended}
            at={demo.live?.line.at ?? demo.lines[demo.lines.length - 1].at}
            compact={compact}
          />
        ) : null}
        {tab === "전사" ? (
          <TranscriptPanel
            lines={demo.lines}
            live={demo.live}
            ended={demo.ended}
            compact={compact}
          />
        ) : null}
        {tab === "요약" ? (
          <SummaryPanel
            ended={demo.ended}
            shown={demo.summary}
            compact={compact}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * 정보 탭. **카드가 없다** — 위는 편집(제목 · 참석자 · 변경 저장), 아래는 읽기(회의 정보
 * 표)이고 그 구분은 컨트롤 테두리가 한다(`note-details.tsx`).
 *
 * 표는 **헤더가 말하지 않은 것만** 담는다. 회의 상태·프로젝트·시작 시각은 바로 위 상단바에
 * 이미 있어서 여기 다시 안 적는다. 그리고 위 셋(회의의 사실)과 아래 둘(문서의 이력) 사이에
 * 선이 하나 있다. 줄마다 밑줄을 긋지 않는다 — 앱의 `Fact`는 테두리가 없다.
 *
 * 컨트롤은 전부 그림이다. 이 랜딩에서 고칠 제목도 부를 서버도 없다.
 */
function DetailsPanel({
  ended,
  at,
  compact,
}: {
  ended: boolean;
  /** 지금까지 기록된 시각. 종료되면 최종값으로 굳는다. */
  at: string;
  compact?: boolean;
}) {
  const facts: Array<[string, React.ReactNode]> = [
    [
      "진행자",
      <>
        <Face who="김민서" compact={compact} />
        <span className="ml-1">
          김민서
          <span className="font-normal text-[var(--lp-muted)]">
            {" · 기록 제어 권한"}
          </span>
        </span>
      </>,
    ],
    [
      "누적 기록 시간",
      <>
        <span className="tabular-nums">{ended ? "01:52" : at}</span>
        <span className="font-normal text-[var(--lp-muted)]">
          {" · 종료된 구간만 합산"}
        </span>
      </>,
    ],
    ["공유 범위", "워크스페이스 멤버에게 공개"],
    ["생성", "2026년 9월 1일 오후 2:00"],
    ["최종 수정", "2026년 9월 1일 오후 2:02"],
  ];

  return (
    <div
      className={`flex flex-col ${compact ? "gap-4 px-[13px] py-3.5" : "gap-5 px-5 py-5"}`}
    >
      <div className={`flex flex-col ${compact ? "gap-3" : "gap-3.5"}`}>
        <Field label="제목" compact={compact}>
          <span
            className={`flex items-center rounded-lg border border-[var(--lp-rule-strong)] bg-[var(--lp-card)] text-[var(--lp-ink)] ${
              compact ? "h-7 px-2 text-[11px]" : "h-8 px-2.5 text-[12px]"
            }`}
          >
            3차 스프린트 킥오프
          </span>
        </Field>

        <Field label="참석자" compact={compact}>
          <div
            className={`flex flex-wrap items-center ${compact ? "gap-2" : "gap-2.5"}`}
          >
            <span className="flex items-center">
              {["김민서", "박지훈", "이서연", "정우재"].map((who, i) => (
                <Face
                  key={who}
                  who={who}
                  compact={compact}
                  className={
                    i === 0 ? "" : "-ml-1.5 ring-2 ring-[var(--lp-card)]"
                  }
                />
              ))}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border border-[var(--lp-rule)] font-medium text-[var(--lp-body)] ${
                compact ? "h-6 px-2 text-[10px]" : "h-7 px-2.5 text-[11px]"
              }`}
            >
              <UserPlus
                aria-hidden
                className={compact ? "size-3" : "size-3.5"}
              />
              참여자 선택
            </span>
          </div>
        </Field>

        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-lg bg-[var(--lp-dark)] font-medium text-[var(--lp-on-dark)] ${
            compact ? "h-6 px-2.5 text-[10px]" : "h-7 px-3 text-[11.5px]"
          }`}
        >
          <Check aria-hidden className={compact ? "size-3" : "size-3.5"} />
          변경 저장
        </span>
      </div>

      <section className="flex flex-col">
        <p
          className={`m-0 font-semibold text-[var(--lp-ink)] ${compact ? "mb-2 text-[11px]" : "mb-2.5 text-[12.5px]"}`}
        >
          회의 정보
        </p>
        <dl className="m-0 flex flex-col">
          {facts.map(([k, v]) => (
            <Fragment key={k}>
              {/* 위는 회의의 사실, 아래는 문서의 이력 — 선 하나로 가른다. */}
              {k === "생성" ? (
                <span
                  aria-hidden
                  className={`block h-px w-full bg-[var(--lp-rule)] ${compact ? "my-2" : "my-2.5"}`}
                />
              ) : null}
              <div
                className={`flex items-center ${compact ? "min-h-[24px] gap-2.5" : "min-h-[26px] gap-3"}`}
              >
                <dt
                  className={`shrink-0 text-[var(--lp-body)] ${compact ? "w-[76px] text-[10px]" : "w-[104px] text-[11.5px]"}`}
                >
                  {k}
                </dt>
                <dd
                  className={`m-0 flex min-w-0 items-center gap-1.5 break-keep font-medium text-[var(--lp-ink)] ${compact ? "text-[10.5px]" : "text-[12px]"}`}
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

/** 라벨 + 컨트롤 한 칸(`note-details.tsx`의 `Field` — 세로 · gap 6 · 라벨 12/600). */
function Field({
  label,
  compact,
  children,
}: {
  label: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={`font-semibold text-[var(--lp-ink)] ${compact ? "text-[10px]" : "text-[11px]"}`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** 참여자 아바타. 전사 줄의 화자 칩과 같은 색을 쓴다. */
function Face({
  who,
  compact,
  className = "",
}: {
  who: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ background: SPEAKER_TINT[who] }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        compact ? "size-[18px] text-[8px]" : "size-[22px] text-[9px]"
      } ${className}`}
    >
      {who.slice(0, 1)}
    </span>
  );
}

/**
 * 바닥을 따라가는 스크롤. **읽으려고 위로 올린 사람을 끌어내리지 않는다.**
 *
 * 새 줄이 붙을 때마다 무조건 바닥으로 보내면, 앞부분을 읽으려고 올린 사람이 대본이 도는
 * 내내 다시 끌려 내려간다 — 스크롤이 사실상 막힌다. **따라갈 의도는 새 DOM이 붙기 전에
 * 읽는다**(`architecture.md`): 사용자의 스크롤 이벤트에서 「지금 바닥 근처인가」를 기록해
 * 두고, 내용이 늘 때 그 값만 본다. 붙은 뒤에 재면 이미 밀린 위치를 재게 된다.
 *
 * `scrollIntoView`가 아니라 `scrollTop`이다 — 이 패널들은 좁은 화면용과 넓은 화면용 두
 * 벌이 다 마운트돼 있어서, 숨은 쪽이 페이지를 끌고 간다.
 */
function useFollowBottom(deps: React.DependencyList, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    // 24px은 한 줄이 채 안 되는 여유다. 정확히 0으로 두면 관성 스크롤의 소수점 오차에
    // 걸려 따라가던 사람이 떨어진다.
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  useEffect(() => {
    if (!enabled || !following.current) return;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // **객체로 안 돌려준다.** `ref={x.ref}`처럼 속성으로 꺼내면 eslint가 그 객체 전체를
  // ref로 보고 「렌더 중에 ref를 읽는다」로 잡는다(`useInView`도 같은 이유로 배열이다).
  return [ref, onScroll] as const;
}

/**
 * 전사 줄은 **두 칸 격자**다 — 왼쪽에 시각, 오른쪽에 화자 한 줄과 그 아래 본문
 * (`note-archive.tsx`의 `grid-cols-[66px_1fr]`). 화자 이름을 본문 옆에 세우지 않는다.
 *
 * 크기는 앱의 0.85배다. 실제 값(본문 15/28)을 그대로 쓰면 여덟 줄이 창 높이를 넘는다.
 *
 * **받아 적는 중인 줄은 말풍선으로 선다.** 자리와 여백은 확정된 줄과 **똑같고** 배경과
 * 모서리만 다르다 — 확정되는 순간 색만 빠지므로 글자가 한 픽셀도 안 움직인다. 앱에는 이
 * 중간 상태가 없다(전사는 확정된 것만 온다). 랜딩이 「말이 이렇게 들어옵니다」를 보이려고
 * 두는 장면이라, 0.4초 뒤에 사라진다.
 */
function TranscriptPanel({
  lines,
  live,
  ended,
  compact,
}: {
  lines: Line[];
  live: { line: Line; text: string } | null;
  /** 화자 칩이 붙는 조건. 앱은 화자 매핑(`diarization.status === "MAPPED"`)이 끝난 뒤에만 붙인다. */
  ended: boolean;
  compact?: boolean;
}) {
  const rows: Array<{ line: Line; typed?: string }> = [
    ...lines.map((line) => ({ line })),
    ...(live ? [{ line: live.line, typed: live.text }] : []),
  ];
  /**
   * 새 줄이 들어오기 전에는 안 붙인다 — 처음부터 바닥이면 좁은 화면이 첫 줄을 지나친 채로
   * 뜬다.
   *
   * **행 수로 재면 안 된다.** 대본의 첫 박자가 `say`라 `cursor` 0에서 이미 빈 `live` 행이
   * 서고, 그러면 한 글자도 안 흘렀는데 `rows.length`가 `BASE_LINES + 1`이 되어 바로 바닥으로
   * 간다. 실제로 **글자가 흘렀거나 줄이 확정된 뒤**부터 따라간다.
   */
  const grew = lines.length > BASE_LINES || (live?.text.length ?? 0) > 0;
  const [scrollRef, onScroll] = useFollowBottom(
    [grew, rows.length, live?.text],
    grew
  );

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className={`h-full overflow-y-auto ${compact ? "px-[13px] pt-2.5 pb-3" : "px-5 pt-4 pb-5"}`}
    >
      <div className="flex justify-end">
        <span
          className={`flex items-center gap-1.5 rounded-lg border border-[var(--lp-rule)] ${compact ? "px-[9px] py-1" : "px-2.5 py-[5px]"}`}
        >
          <Copy
            aria-hidden
            className={
              compact ? "size-2.5 text-[#8a7a6d]" : "size-3 text-[#8a7a6d]"
            }
          />
          <span
            className={`font-medium text-[var(--lp-body)] ${compact ? "text-[9.5px]" : "text-[11px]"}`}
          >
            복사
          </span>
        </span>
      </div>
      <ul className={`m-0 list-none p-0 ${compact ? "" : "mt-1"}`}>
        {rows.map(({ line, typed }, i) => (
          <li
            key={line.at}
            // 처음부터 있던 줄만 순서대로 든다. 대본이 올린 줄은 이미 말풍선으로 떠 있던
            // 것이라 다시 등장시킬 필요가 없다.
            data-stagger={i < BASE_LINES ? "" : undefined}
            style={{ "--i": i } as React.CSSProperties}
            className={`grid border-b border-[var(--lp-rule-soft)] ${
              compact
                ? "grid-cols-[34px_1fr] gap-2.5 py-2.5"
                : "grid-cols-[56px_1fr] gap-5 py-3.5"
            }`}
          >
            {/* 받아 적는 중인 줄은 **시각 자리에 상태를 적는다** — 아직 확정 안 된 발화라
                시각도 확정이 아니다(`transcript-view.tsx`의 partial 행). 살아 있다는 신호는
                붉은 점이 한다. */}
            {typed === undefined ? (
              <span
                className={`font-mono tabular-nums text-[var(--lp-faint)] ${compact ? "text-[9.5px]" : "pt-0.5 text-[10px]"}`}
              >
                {line.at}
              </span>
            ) : (
              <span
                className={`flex items-center gap-1.5 whitespace-nowrap text-[var(--lp-muted)] ${compact ? "text-[9px]" : "pt-0.5 text-[10px]"}`}
              >
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 animate-pulse rounded-full bg-[var(--lp-rec)]"
                />
                받아 적는 중
              </span>
            )}
            <div className="min-w-0">
              {/* **화자는 회의가 끝난 뒤에 붙는다.** 앱은 화자 매핑이 `MAPPED`가 돼야 칩을
                  그리고, 그 매핑은 종료 뒤에 돈다(`transcript-view.tsx`의 `diarized`).
                  기록 중에는 시각과 본문뿐이다.

                  **붙는 것은 이름이 아니라 「화자 A」다.** 사람과 잇는 것은 그다음이고 그건
                  사용자가 한다(`speaker-identity.ts`의 `displayName` — 연결 안 됐으면
                  `화자 A`). 칩 안 글자도 이름의 첫 자가 아니라 **라벨**이다: 이름이 없으면
                  전부 「화」가 되어 얼굴이 서로를 못 가린다.

                  파스텔은 **바탕으로만** 쓴다(`DESIGN.md`). 뒤의 회색 점은 「아직 확인하지
                  않은 화자」 표시다 — 눈에 띄어야 이름을 붙일 이유가 생긴다. */}
              {ended ? (
                <span
                  // 여덟이 한 프레임에 붙으면 「원래 있던 것」으로 읽힌다. 위에서부터
                  // 차례로 들어와야 **방금 갈렸다**가 보인다.
                  data-enter
                  style={{ "--i": i } as React.CSSProperties}
                  className={`inline-flex items-center gap-1.5 font-medium text-[var(--lp-muted)] ${compact ? "text-[10px]" : "text-[11.5px]"}`}
                >
                  <span
                    aria-hidden
                    style={{
                      background: SPEAKER_LABEL_TINT[SPEAKER_LABEL[line.who]],
                    }}
                    className={`flex shrink-0 items-center justify-center rounded-full text-[var(--lp-ink)] ${
                      compact
                        ? "size-[15px] text-[8px]"
                        : "size-[17px] text-[9px]"
                    }`}
                  >
                    {SPEAKER_LABEL[line.who]}
                  </span>
                  화자 {SPEAKER_LABEL[line.who]}
                  <span
                    aria-label="아직 확인하지 않은 화자"
                    className="size-1.5 shrink-0 rounded-full bg-[var(--lp-faint)]"
                  />
                </span>
              ) : null}
              {/* 음수 여백이 안쪽 여백을 정확히 상쇄한다 — 말풍선이 붙었다 빠져도 글자
                  자리가 그대로다. */}
              <p
                data-live={typed === undefined ? undefined : ""}
                className={`lp-said m-0 mt-0.5 -mx-2 -my-1 break-keep px-2 py-1 text-[var(--lp-ink)] ${compact ? "text-[11.5px] leading-[1.65]" : "text-[13px] leading-[1.75]"}`}
              >
                {typed ?? line.text}
                {typed === undefined ? null : (
                  <span aria-hidden className="lp-caret" />
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 개요 → 액션 아이템 → 결정을 위에서 아래로. 항목 뒤에 근거 마커가 붙는다.
 *
 * 문구는 앱 것 그대로다 — 끝나기 전에는 「요약은 회의가 끝나면 생성됩니다」, 도는 동안은
 * 「회의를 정리하고 있습니다」(`note-summary.tsx`).
 */
function SummaryPanel({
  ended,
  shown,
  compact,
}: {
  ended: boolean;
  shown: number;
  compact?: boolean;
}) {
  if (!ended || shown === 0) {
    return (
      <div className={compact ? "px-[13px] py-3.5" : "px-5 py-5"}>
        <div
          className={`rounded-xl border border-[var(--lp-rule)] bg-[var(--lp-canvas)] ${compact ? "p-3.5" : "p-5"}`}
        >
          <div className="flex items-center gap-2.5">
            {ended ? (
              <Loader2
                aria-hidden
                className={`shrink-0 animate-spin text-[var(--lp-muted)] ${compact ? "size-3.5" : "size-4"}`}
              />
            ) : null}
            <p
              className={`m-0 font-medium text-[var(--lp-ink)] ${compact ? "text-[11.5px]" : "text-[13px]"}`}
            >
              {ended
                ? "회의를 정리하고 있습니다"
                : "요약은 회의가 끝나면 생성됩니다"}
            </p>
          </div>
          <p
            className={`m-0 mt-1.5 break-keep leading-[1.6] text-[var(--lp-muted)] ${compact ? "text-[10px]" : "text-[11.5px]"} ${ended ? (compact ? "pl-6" : "pl-[26px]") : ""}`}
          >
            {ended
              ? "다른 화면으로 옮겨도 됩니다. 정리가 끝나면 이 탭에 나타납니다."
              : "회의를 종료하면 개요 · 액션 아이템 · 결정이 자동으로 정리됩니다."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${compact ? "gap-5 px-[13px] py-3.5" : "gap-8 px-5 py-5"}`}
    >
      {SUMMARY.slice(0, shown).map(([label, items]) => (
        <section
          key={label}
          data-enter
          style={{ "--i": 0 } as React.CSSProperties}
        >
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
          <ul
            className={`m-0 list-none p-0 ${compact ? "mt-3 space-y-3" : "mt-4 space-y-4"}`}
          >
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
  demo: Demo;
};

function RailPanels({
  compact,
  ...shared
}: RailShared & { compact?: boolean }) {
  const tab = shared.demo.railTab;
  /**
   * **대본이 레일을 옮기면 이 안의 포커스가 `<body>`로 떨어진다.** 탭을 바꾸는 것은 조건부
   * 렌더라, 사건 범위 칩이나 묶음 버튼에 서 있던 키보드 사용자는 누른 적도 없이 자리를
   * 잃는다(다음 Tab이 페이지 맨 위로 돌아간다). 대본을 멈출 수는 없으니 — 멈추면 그 장면을
   * 못 본다 — **고른 탭으로 옮겨 준다.**
   *
   * **안에 있었는지는 미리 적어 둔다.** 효과가 도는 시점에는 이미 지워진 뒤라 그때 재면
   * 늘 `<body>`다. 지워질 때는 `blur`가 안 오므로 이 표시는 켜진 채로 남고, 사용자가 제
   * 발로 나갔을 때만 꺼진다.
   */
  const wasInside = useRef(false);
  useEffect(() => {
    if (!wasInside.current) return;
    // 사용자가 그 사이 다른 곳을 잡았으면 뺏지 않는다.
    if (document.activeElement && document.activeElement !== document.body)
      return;
    wasInside.current = false;
    document
      .getElementById(`${shared.uid}-rail-${RAIL_TABS.indexOf(tab)}`)
      ?.focus();
  }, [tab, shared.uid]);

  return (
    <div
      onFocus={() => {
        wasInside.current = true;
      }}
      onBlur={() => {
        wasInside.current = false;
      }}
      role="tabpanel"
      id={`${shared.uid}-rail-panel`}
      aria-labelledby={`${shared.uid}-rail-${RAIL_TABS.indexOf(tab)}`}
      // 넓은 화면은 노트 쪽과 같은 값이라 두 기둥의 바닥선이 맞는다.
      className={`overflow-hidden ${compact ? "h-[532px]" : "h-[676px]"}`}
    >
      {/* `h-full` — 에이전트 패널은 컴포저를 바닥에 붙이고 대화만 흐르게 해야 해서
          자기 높이를 알아야 한다. 실시간 정리는 원래대로 넘치는 만큼 잘린다. */}
      <div key={tab} data-panel className="h-full">
        {tab === "실시간 정리" ? (
          <ContextPanel compact={compact} {...shared} />
        ) : null}
        {tab === "내 에이전트" ? (
          <AgentPanel
            compact={compact}
            turns={shared.demo.turns}
            typing={shared.demo.typing}
            typingAt={shared.demo.typingAt}
            ask={shared.demo.ask}
          />
        ) : null}
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
  demo,
}: RailShared & { compact?: boolean }) {
  // 드러난 것만 센다 — 아직 안 올라온 사건이 개수에만 미리 잡히면 칩이 거짓말을 한다.
  const seen = CONTEXT.slice(0, demo.events);
  const count = (s: Scope) =>
    seen.filter((i) => s === "전체" || i.outcome === s).length;
  const groups = CONTEXT_KINDS.map((kind) => ({
    kind,
    icon: CONTEXT_ICON[kind],
    items: seen
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          item.kind === kind && (scope === "전체" || item.outcome === scope)
      ),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className={`flex flex-col ${compact ? "gap-3 px-[13px] pt-3 pb-3.5" : "gap-[18px] px-4 pt-[22px] pb-5"}`}
    >
      <div className="flex items-center gap-2.5">
        {compact ? (
          <Bot
            aria-hidden
            className="size-[13px] shrink-0 text-[var(--lp-accent)]"
          />
        ) : null}
        <span
          className={`font-semibold tracking-[-0.3px] text-[var(--lp-ink)] ${compact ? "text-[14px]" : "text-[17px] leading-none"}`}
        >
          사건 흐름
        </span>
        <span
          className={`ml-auto shrink-0 rounded-full border border-[var(--lp-rule)] bg-[var(--lp-card)] tabular-nums text-[var(--lp-muted)] ${compact ? "px-2 py-px text-[10px]" : "px-[9px] py-[3px] text-[10.5px]"}`}
        >
          지금까지 {demo.events}건
        </span>
      </div>

      <p
        className={`m-0 break-keep leading-[1.5] text-[#8a7a6d] ${compact ? "-mt-1.5 text-[10.5px]" : "-mt-2 text-[11.5px]"}`}
      >
        이 회의에서 남길 만한 변화만 기록했습니다.
      </p>

      {/* 범위 칩. `aria-pressed`로 눌린 상태를 말한다 — 라벨과 개수가 다른 요소라
          그냥 두면 「전체5」로 읽힌다. */}
      <div
        role="group"
        aria-label="사건 범위로 좁히기"
        className="flex flex-wrap gap-1.5"
      >
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

      {groups.map(({ kind, icon: Icon, items }, index) => {
        const open = !closed.has(kind);
        // 「할 일」에 공백이 있어 그대로 쓰면 `aria-controls` 가 갈린다.
        const listId = `${uid}-group-${index}`;
        return (
          <div
            key={kind}
            className={`flex flex-col ${compact ? "gap-2" : "gap-[9px]"}`}
          >
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => toggleGroup(kind)}
              className={`group flex min-h-6 w-full items-center text-left ${compact ? "gap-2" : "gap-[9px] px-0.5"}`}
            >
              <Icon
                aria-hidden
                className="size-[15px] shrink-0 text-[var(--lp-body)]"
              />
              <span
                className={`font-semibold text-[var(--lp-ink)] ${compact ? "text-[11.5px]" : "text-[13px]"}`}
              >
                {kind}
              </span>
              <span
                aria-hidden
                className="block h-px min-w-0 flex-1 bg-[var(--lp-rule)]"
              />
              <span
                className={`shrink-0 font-mono tabular-nums text-[var(--lp-faint)] ${compact ? "text-[10px]" : "text-[10.5px]"}`}
              >
                {items.length}
              </span>
              <ChevronDown
                aria-hidden
                className={`size-3.5 shrink-0 transition-[transform,color] group-hover:text-[var(--lp-ink)] ${
                  open
                    ? "rotate-180 text-[var(--lp-muted)]"
                    : "text-[var(--lp-faint)]"
                }`}
              />
            </button>
            {open ? (
              <ul
                id={listId}
                className={`m-0 flex list-none flex-col p-0 ${compact ? "gap-[7px]" : "gap-2"}`}
              >
                {items.map(({ item: it, index }) => (
                  <li
                    key={it.title}
                    // 대본이 올린 카드만 든다. 처음부터 있던 셋은 밴드가 뜰 때 이미 섰다.
                    data-fresh={index >= BASE_EVENTS ? "" : undefined}
                    style={{ "--i": 0 } as React.CSSProperties}
                    className={`flex rounded-xl border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_1px_2px_#33231a10] ${
                      compact
                        ? "gap-2.5 px-3 py-2.5"
                        : "gap-[11px] px-3.5 py-[13px]"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex shrink-0 items-center justify-center rounded-lg border border-[var(--lp-rule)] bg-[var(--lp-canvas)] ${compact ? "size-[22px]" : "size-[26px]"}`}
                    >
                      <Icon
                        className={
                          compact
                            ? "size-3 text-[var(--lp-body)]"
                            : "size-3.5 text-[var(--lp-body)]"
                        }
                      />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <span
                          className={`min-w-0 flex-1 break-keep font-medium leading-[1.45] text-[var(--lp-ink)] ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}
                        >
                          {it.title}
                        </span>
                        <span
                          className={`shrink-0 font-mono tabular-nums text-[var(--lp-faint)] ${compact ? "text-[9.5px]" : "text-[10px]"}`}
                        >
                          {it.at}
                        </span>
                        <span
                          className={`shrink-0 font-mono tabular-nums text-[var(--lp-faint)] ${compact ? "text-[9.5px]" : "text-[10px]"}`}
                        >
                          +{it.more}
                        </span>
                        <ChevronDown
                          aria-hidden
                          className="size-3 shrink-0 text-[var(--lp-faint)]"
                        />
                      </div>
                      {(compact ? it.metaSm : it.meta) ? (
                        <span
                          className={`text-[var(--lp-muted)] ${compact ? "text-[9.5px]" : "text-[10.5px]"}`}
                        >
                          {compact ? it.metaSm : it.meta}
                        </span>
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
 *
 * **여기서 실제로 물어볼 수 있다.** 준비된 질문을 누르면 답이 흐르고 참고한 회의록이
 * 붙는다. 입력창을 열어 두고 아무 문장이나 받는 쪽이 더 그럴듯하지만, 그러려면 비로그인
 * 질의를 받는 서버가 있어야 하고 없이 흉내만 내면 「사실 대조판」이 첫 화면부터 거짓이 된다.
 * 그래서 **답이 실제로 있는 질문만** 낸다.
 */
function AgentPanel({
  compact,
  turns,
  typing,
  typingAt,
  ask,
}: { compact?: boolean } & Pick<
  Demo,
  "turns" | "typing" | "typingAt" | "ask"
>) {
  const [threadRef, onScroll] = useFollowBottom([turns, typing]);

  return (
    <div
      className={`flex h-full flex-col ${compact ? "px-[13px] pb-3.5" : "px-3 pb-4"}`}
    >
      <p
        className={`m-0 shrink-0 font-medium text-[var(--lp-body)] ${compact ? "px-0 py-1.5 text-[10px]" : "px-1 py-2 text-[11px]"}`}
      >
        나만 보는 대화 · 현재 회의 범위
      </p>

      {/* 흐르는 중에는 답을 `aria-hidden`으로 둔다 — 글자마다 읽어 주면 한 문장을 수십 번
          듣는다. 다 흐르면 통째로 드러나 live 영역이 한 번 읽는다. */}
      <div
        ref={threadRef}
        onScroll={onScroll}
        aria-live="polite"
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${compact ? "gap-2.5 pt-1" : "gap-3 pt-2"}`}
      >
        {turns.map((turn, i) => {
          const running = i === typingAt && typing !== null;
          const thinking = running && typing === THINKING;
          return (
            <div
              key={`${i}-${turn.q}`}
              // 처음부터 떠 있는 왕복(`SEED`)은 안 든다 — 밴드가 뜰 때 이미 서 있다.
              data-turn={i === 0 ? undefined : ""}
              className={`flex shrink-0 flex-col ${compact ? "gap-2.5" : "gap-3"}`}
            >
              <div
                className={`max-w-[82%] self-end rounded-[12px_12px_4px_12px] bg-[var(--lp-rule-soft)] ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}
              >
                <span
                  className={`break-keep leading-[1.5] text-[var(--lp-ink)] ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}
                >
                  {turn.q}
                </span>
              </div>

              <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
                <div className="flex items-center gap-1.5">
                  <Sparkles
                    aria-hidden
                    className="size-3 shrink-0 text-[var(--lp-accent)]"
                  />
                  <span
                    className={`font-semibold text-[var(--lp-accent)] ${compact ? "text-[10px]" : "text-[10.5px]"}`}
                  >
                    HeyMoa
                  </span>
                </div>
                {/* 아직 아무것도 안 내놓은 구간. **스피너를 안 쓴다** — 도는 원은 어디서나
                    도는 원이지만, 빛이 문장 위를 지나가면 그 문장이 지금 살아 있다는
                    뜻이 된다(앱의 `ThinkingLine`이 같은 결이다). */}
                {thinking ? (
                  <p
                    className={`lp-shimmer m-0 ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}
                  >
                    생각하는 중
                  </p>
                ) : (
                  <p
                    aria-hidden={running || undefined}
                    className={`m-0 break-keep leading-[1.65] text-[var(--lp-body)] ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}
                  >
                    {running ? turn.a.slice(0, typing ?? 0) : turn.a}
                    {/* 전사의 받아 적는 줄과 같은 커서다 — 글자만 늘면 「이미 적힌 글」과
                        구분이 안 된다. */}
                    {running ? <span aria-hidden className="lp-caret" /> : null}
                  </p>
                )}
                {/* 근거는 **답이 끝난 뒤에** 선다. 흐르는 중에 그리면 아직 안 읽은 회의록이
                    이미 붙은 것처럼 보인다(`chat-thread.tsx`가 같은 자리를 그렇게 가른다). */}
                {running ? null : (
                  <div
                    data-enter
                    className="flex flex-wrap items-center gap-[5px]"
                    style={{ "--i": 0 } as React.CSSProperties}
                  >
                    {turn.refs.map((chip) => (
                      <span
                        key={chip}
                        className={`rounded-full bg-[var(--lp-rule-soft)] font-medium text-[var(--lp-body)] ${compact ? "px-2 py-[3px] text-[9.5px]" : "px-[7px] py-[3px] text-[9.5px]"}`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* **「예시 질문」이라고 적는다.** 앱에는 이 줄이 없다 — 랜딩이 눌러 보라고 놓은
          것이라서, 라벨을 빼면 앱에 있는 기능처럼 읽힌다. */}
      <div className={`shrink-0 ${compact ? "pt-2.5" : "pt-3"}`}>
        <p
          className={`m-0 text-[var(--lp-faint)] ${compact ? "text-[9.5px]" : "text-[10px]"}`}
        >
          예시 질문
        </p>
        <div
          role="group"
          aria-label="예시 질문"
          className={`flex flex-wrap gap-1.5 ${compact ? "pt-1.5" : "pt-2"}`}
        >
          {ASKS.map((item) => (
            <button
              key={item.q}
              type="button"
              disabled={typing !== null}
              onClick={() => ask(item)}
              className={`flex min-h-6 shrink-0 items-center rounded-full border border-[var(--lp-rule)] font-medium text-[var(--lp-body)] transition-colors hover:border-[var(--lp-rule-strong)] hover:text-[var(--lp-ink)] disabled:opacity-45 ${compact ? "px-2 text-[10px]" : "px-[11px] text-[11px]"}`}
            >
              {item.q}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`mt-3 flex shrink-0 items-center gap-[7px] rounded-full border border-[var(--lp-rule-strong)] ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}
      >
        <span
          className={`text-[var(--lp-faint)] ${compact ? "text-[10.5px]" : "text-[11px]"}`}
        >
          이 회의에 대해 물어보기
        </span>
        <span className="flex-1" />
        <ArrowUp aria-hidden className="size-3 shrink-0 text-[#8a7a6d]" />
      </div>
    </div>
  );
}
