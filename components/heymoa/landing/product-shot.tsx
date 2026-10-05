"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Clock,
  Copy,
  FileText,
  Folder,
  History,
  LoaderCircle,
  Mic,
  MoreHorizontal,
  PanelRightClose,
  Pause,
  Play,
  Plus,
  Shrink,
  SkipForward,
  Sparkles,
  Square,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  PersonAvatar,
  unnamedSpeakerAvatarKey,
} from "@/components/heymoa/person-avatar";
import { CONTAINER, SECTION_X } from "@/components/heymoa/landing/shell";
import {
  ASKS,
  BASE_LINES,
  FACE_KEY,
  FILTER_OF,
  FILTERS,
  LENGTH,
  NOTE_TABS,
  PROJECT,
  REVIEW,
  REVIEW_PARTS,
  SPEAKER_LABEL,
  THINKING,
  TIMELINE,
  TITLE,
  TRANSCRIPT,
  useDemo,
  useInView,
  type Demo,
  type Entry,
  type Filter,
  type Line,
  type NoteTab,
  type Status,
} from "@/components/heymoa/landing/use-demo";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import type { TimelineTone } from "@/lib/notes/proposals/timeline";

/**
 * 히어로 아래 제품 화면. **혼자 한 바퀴 돈다** — 말이 스크립트로 받아 적히고, 타임라인에
 * 쌓이고, 에이전트가 답하고, 독에서 중지한 뒤 회의를 끝내면 요약 탭에 검토 문서가 선다.
 * 대본과 시간은 `use-demo.ts`에 있고 여기는 그 상태를 그리기만 한다.
 *
 * **그리고 실제로 눌린다.** 정보 · 스크립트 · 타임라인 · 요약이 진짜 탭이고, 타임라인의 유형
 * 골라 보기 · 안건 접기 · 항목 펼치기, 예시 질문, 참고한 회의록 펼치기가 다 동작한다. 탭을
 * 누르면 **그 탭만** 그 자리에 못 박히고 대본은 계속 돈다 — 눌러 보라고 해 놓고 화면이 딴
 * 데로 가도 안 되지만, 거기서 대본까지 끊으면 보여 주려던 것이 통째로 사라진다. **장면이
 * 바뀌는 이동(타임라인 · 요약)에는 같이 간다** — 고정이 그것까지 막으면 이번엔 장면 하나를
 * 못 본다. 한 바퀴가 끝나면 스스로 처음으로 돌아가고, 그때 고정이 풀린다. 화면 밖으로
 * 나가면 대본이 쉬고, 매트 구석의 일시정지로 방문자가 세울 수도 있다(WCAG 2.2.2).
 *
 * **눌리는 것을 그리는 순간 진짜 버튼이어야 한다.** `role="tablist"`와 방향키 이동
 * (roving tabIndex)까지 앱과 같게 둔다. 반대로 앱 화면을 **흉내만 내는** 것들(뒤로 · 사이드
 * 뷰 · 노트 메뉴 · 복사 · 녹음 독 · 회의 종료 · 검토 완료 · 입력창)은 `<span>`이다 — 눌러도
 * 할 일이 없는 것을 버튼으로 두면 탭 순회에 빈 정거장이 늘 뿐이다.
 *
 * **좁은 화면과 넓은 화면이 다른 그림이다.** 아트보드 1440은 크림 매트 위에 창 하나를 얹고
 * 그 안을 노트와 「내 에이전트」 레일로 나누지만, 390은 매트 안에 카드 **둘**을 세로로
 * 쌓는다 — 390px에서 창 하나를 반으로 가르면 양쪽 다 못 읽는다. 틀은 둘로 나뉘지만 **패널은
 * 한 벌**이고 `compact`로 배율만 가른다.
 *
 * **패널 높이를 고정한다.** 탭마다 내용 길이가 달라서 그대로 두면 정보 탭을 누를 때 아래
 * 밴드가 통째로 올라온다. 앱도 고정 높이 뷰포트 안에서 스크롤하므로 이쪽이 실제에 가깝다.
 *
 * **구조는 시안이 아니라 실제 앱을 따른다**(`note-panel.tsx` · `note-agent-rail.tsx` ·
 * `transcript-view.tsx` · `note-archive.tsx` · `note-timeline.tsx` · `note-details.tsx` ·
 * `meeting-controls.tsx` · `recording-dock.tsx` · `review/*` · `chat/*`). 이 랜딩의 전제가
 * 「사실 대조판」이라, 목업이 앱과 어긋나면 목업이 틀린 것이다. 크기는 앱의 0.85배다.
 *
 * **이 안의 글자는 삽화다.** `--lp-faint`나 9~11px 라벨은 페이지가 하는 말이 아니라 앱 화면을
 * 그린 그림이라 실제 앱의 크기와 색을 따른다. 페이지가 직접 하는 말(`--lp-body` 이상)과 섞어
 * 쓰지 않는다 — 대비 기준이 다르다.
 */

export function ProductShot() {
  /**
   * 창 하나가 상태를 다 갖는다. 좁은 화면의 카드 둘은 같은 상태를 나눠 쓰므로, 폭이
   * 바뀌어도 보던 탭이 그대로 남는다.
   */
  const [visible, seen, watch] = useInView();
  const demo = useDemo({ visible, seen });
  const uid = useId();

  /**
   * **좁은 화면용과 넓은 화면용이 둘 다 마운트된다**(CSS로 하나만 보인다). 같은 `uid`를
   * 주면 탭과 패널의 `id`가 통째로 겹쳐서, `aria-controls`·`aria-labelledby`가 DOM에서
   * 먼저 나온 숨은 쪽을 가리킨다 — 보이는 탭의 관계가 끊긴다. 접두사를 가른다.
   */
  const smUid = `${uid}-sm`;
  const lgUid = `${uid}-lg`;

  return (
    <section
      ref={watch}
      // 일시정지는 대본만이 아니라 혼자 도는 그림(파형 · 커서 · 빛)까지 세운다 — `globals.css`.
      data-paused={demo.paused || undefined}
      className={`${SECTION_X} flex flex-col items-center pt-9 pb-16 lg:pt-14 lg:pb-25`}
    >
      {/* 좁은 매트 — 카드 둘 */}
      <div className="box-border flex w-full flex-col gap-2.5 rounded-[20px] bg-[var(--lp-cream)] p-3 lg:hidden">
        <div className={`${CARD} overflow-hidden`}>
          {/* 앱도 좁은 화면에서는 탭 줄이 둘째 줄로 내려간다(`note-panel.tsx`의 `max-sm:order-last`). */}
          <div className="flex items-center gap-2 px-[13px] pt-[11px] pb-1.5">
            <StatusChip status={demo.status} compact />
            <span className="min-w-0 flex-1 truncate break-keep text-[13px] font-semibold text-[var(--lp-ink)]">
              {TITLE}
            </span>
            <EndButton
              status={demo.status}
              pressing={demo.pressing}
              compact
            />
            {demo.status === "기록 중" ? null : <NoteMenu compact />}
          </div>
          <NoteTabList
            value={demo.noteTab}
            onChange={demo.setNoteTab}
            uid={smUid}
            compact
          />
          <NotePanels demo={demo} uid={smUid} compact />
        </div>

        <div className={`${CARD} overflow-hidden`}>
          <AgentRail demo={demo} compact />
        </div>
        <div className="-my-1 flex justify-end">
          <PlayToggle paused={demo.paused} onToggle={demo.togglePaused} />
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
            {/* 상단바는 **노트 기둥 안**에 산다 — 창 전체를 가로지르지 않는다
                (`note-panel.tsx`의 `h-14` 바). 레일은 제 머리줄을 따로 이고 옆에 선다. */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--lp-rule-soft)] px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {/* 창 제어(`목록으로` · `사이드 뷰로 보기`) — 그림이다. */}
                  <span className="flex shrink-0 items-center gap-0.5 text-[var(--lp-muted)]">
                    <span className="flex size-7 items-center justify-center">
                      <ArrowLeft aria-hidden className="size-[15px]" />
                    </span>
                    <span className="flex size-7 items-center justify-center">
                      <Shrink aria-hidden className="size-[14px]" />
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="h-[15px] w-px shrink-0 bg-[var(--lp-rule)]"
                  />
                  <StatusChip status={demo.status} />
                  <span className="min-w-0 truncate break-keep text-[12.5px] font-semibold text-[var(--lp-ink)]">
                    {TITLE}
                  </span>
                </div>
                <NoteTabList
                  value={demo.noteTab}
                  onChange={demo.setNoteTab}
                  uid={lgUid}
                />
                <EndButton status={demo.status} pressing={demo.pressing} />
                {/* 노트 메뉴는 기록 중에 숨는다 — 삭제를 서버가 409로 막으니 눌러서 실패하게
                    두지 않는다(`note-panel.tsx`). */}
                {demo.status === "기록 중" ? null : <NoteMenu />}
              </div>
              <NotePanels demo={demo} uid={lgUid} />
            </div>

            {/* 레일 폭은 앱의 440 × 0.85. 앱은 패널 둘 사이에 틈을 두지만, 여기는 창 하나라
                세로 선 하나로 가른다. */}
            <div className="box-border flex w-[372px] shrink-0 flex-col border-l border-[var(--lp-rule-soft)]">
              <AgentRail demo={demo} />
            </div>
          </div>
        </div>
        <div className="mt-2.5 -mb-2 flex justify-end">
          <PlayToggle paused={demo.paused} onToggle={demo.togglePaused} />
        </div>
      </div>
    </section>
  );
}

/**
 * 대본 일시정지(WCAG 2.2.2). 제품 샷은 화면에 있는 동안 스스로 계속 도는 움직임이라, 멈출
 * 수단이 없으면 옆의 글을 읽으려는 사람이 그것을 못 끈다 — 모션 줄이기 설정은 이 기준의
 * 수단으로 안 친다.
 *
 * **페이지가 하는 말이다.** 앱 화면의 그림이 아니라서 창 안이 아니라 매트 구석에 서고, 글자는
 * `--lp-muted`보다 진한 `--lp-body`다(크림 위 `--lp-muted`는 4.5:1에 겨우 걸린다). 모션을
 * 줄인 사람에게는 돌 것이 없으니 감춘다 — 그 판정은 CSS가 한다(JS로 하면 첫 렌더가 갈린다).
 *
 * **라벨이 상태를 말한다**(「일시정지」 ↔ 「재생」). `aria-pressed`는 안 건다 — 라벨이 바뀌는
 * 버튼에 눌림까지 붙이면 「재생, 눌림」처럼 거꾸로 읽힌다(APG 버튼 패턴).
 */
function PlayToggle({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  const Icon = paused ? Play : Pause;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-[var(--lp-body)] transition-colors hover:bg-[var(--lp-cream-soft)] hover:text-[var(--lp-ink)] motion-reduce:hidden"
    >
      <Icon aria-hidden className="size-3" />
      {paused ? "재생" : "일시정지"}
    </button>
  );
}

const CARD =
  "box-border rounded-[14px] border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_2px_8px_#33231a12]";

/** 앱 칩의 그림자(`shadow-e2`)를 랜딩 잉크로 옮긴 값. 독과 검토 막대가 쓴다. */
const FLOAT_SHADOW = "shadow-[0_2px_4px_#33231a0f,0_10px_28px_#33231a1c]";

/**
 * 회의 상태 칩. **기록 중만 붉고, 바탕이 없다**(`meeting-controls.tsx`의
 * `MeetingStatusChip`). 중지됨은 `Pause`, 종료됨은 회색 점이다. 라벨은 앱의
 * `MEETING_STATUS_LABEL` 그대로다.
 */
function StatusChip({
  status,
  compact,
}: {
  status: Status;
  compact?: boolean;
}) {
  const live = status === "기록 중";
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 font-semibold ${
        live ? "text-[var(--lp-rec-ink)]" : "text-[var(--lp-muted)]"
      } ${compact ? "text-[10px]" : "text-[10.5px]"}`}
    >
      {status === "중지됨" ? (
        <Pause aria-hidden className="size-3 shrink-0" />
      ) : (
        <span
          aria-hidden
          className={`block size-1.5 shrink-0 rounded-full ${live ? "bg-[var(--lp-rec)]" : "bg-[var(--lp-muted)]"}`}
        />
      )}
      {status}
    </span>
  );
}

/**
 * 회의 종료(`meeting-controls.tsx` — h32 · r8 · destructive 테두리와 글자 · 12px).
 *
 * **기록 중에는 잠겨 있다**(APP-695 — 「중지한 뒤 종료할 수 있습니다」). 독에서 먼저 멈춰야
 * 살아난다. 대본도 그 순서로 누른다.
 *
 * **그림이다.** 한때 진짜로 눌렸는데, 누르는 순간 기록 중이던 회의가 종료로 확 넘어가서
 * 「내가 뭘 부순 건가」로 읽혔다 — 앱에서는 다이얼로그가 한 번 더 묻고 되돌릴 수 없는
 * 일이라는 것을 말해 주지만(`meeting-end-dialog.tsx`), 랜딩에서 그 확인창까지 그리면
 * 이 자리가 회의 종료를 배우는 화면이 되어 버린다. 대본이 제때 누른다.
 *
 * **누르는 순간을 보여 준다.** 버튼이 그냥 사라지고 칩만 바뀌면 「누가 눌렀다」는 순간이
 * 화면 어디에도 없다. **끝나도 언마운트하지 않는다** — 지우면 버튼이 한 프레임에 없어져
 * 팝으로 읽힌다. 폭을 접어서 내보내면 눌러서 사라진 것으로 읽힌다.
 */
function EndButton({
  status,
  pressing,
  compact,
}: {
  status: Status;
  pressing: boolean;
  compact?: boolean;
}) {
  const gone = status === "종료됨";
  return (
    <span
      aria-hidden={gone || undefined}
      data-disabled={status === "기록 중" ? "" : undefined}
      data-pressing={pressing ? "" : undefined}
      data-gone={gone ? "" : undefined}
      className={`lp-end inline-flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-[var(--lp-rec)] font-medium text-[var(--lp-rec-ink)] data-[disabled]:opacity-[0.45] ${
        compact ? "h-6 px-1.5 text-[10px]" : "h-7 px-2.5 text-[11.5px]"
      }`}
    >
      <CircleStop
        aria-hidden
        className={compact ? "size-3" : "size-[13px]"}
      />
      회의 종료
    </span>
  );
}

/** 노트 메뉴(`MoreHorizontal`). 기록 중이 아닐 때만 선다 — 그림이다. */
function NoteMenu({ compact }: { compact?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg border border-[var(--lp-rule)] text-[var(--lp-muted)] ${compact ? "size-6" : "size-7"}`}
    >
      <MoreHorizontal aria-hidden className={compact ? "size-3" : "size-3.5"} />
    </span>
  );
}

/* ── 탭 ─────────────────────────────────────────────────────────────────── */

/**
 * 방향키로 옮기면 선택도 함께 바뀐다(automatic activation). 패널이 바뀌는 비용이 없으므로,
 * 화살표만 눌러도 내용이 따라오는 쪽이 빠르다 — 앱의 `Tabs`가 같은 판단을 한다.
 *
 * **출발점은 포커스가 선 탭이다**, 선택된 탭이 아니다. 대본이 탭을 옮길 때(타임라인 · 요약)는
 * 선택만 바뀌고 포커스는 그대로라, 선택값에서 출발하면 다음 →가 키보드 사용자가 서 있는 탭의
 * 옆이 아니라 대본이 고른 탭의 옆으로 간다. 탭 줄 자체가 받은 키만 선택값으로 돌아간다.
 */
function useTabKeys<T extends string>(
  tabs: readonly T[],
  value: T,
  onChange: (t: T) => void
) {
  return (event: React.KeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1;
    const els = [
      ...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
    ];
    const focused = els.indexOf(event.target as HTMLElement);
    const at = focused >= 0 ? focused : tabs.indexOf(value);
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
    els[next]?.focus();
  };
}

/**
 * 앱과 같은 **밑줄 탭**이다(`note-panel.tsx`의 `TabsList variant="line"`). 균등 분할이 아니라
 * 라벨 폭만 차지하고, 차례는 정보 · 스크립트 · 타임라인 · 요약이다.
 */
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
          : "flex h-14 shrink-0 items-center gap-[18px]"
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
            compact ? "h-8 text-[10.5px]" : "h-14 text-[12px]"
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

/* ── 노트 패널 ──────────────────────────────────────────────────────────── */

/**
 * 높이를 고정한다 — 탭마다 길이가 달라서 그대로 두면 정보 탭을 누를 때 아래 밴드가
 * 통째로 올라온다. 앱도 고정 높이 뷰포트 안에서 스크롤한다.
 *
 * 녹음 독은 이 상자 바닥 가운데에 뜬다 — 앱도 노트 아래 가운데에 떠서 어느 탭에서나 보인다.
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
  const at = demo.live?.line.at ?? demo.lines[demo.lines.length - 1].at;

  /**
   * **대본이 탭을 옮기면 이 안의 포커스가 `<body>`로 떨어진다.** 탭을 바꾸는 것은 조건부
   * 렌더라, 타임라인의 골라 보기 칩이나 안건 머리에 서 있던 키보드 사용자는 누른 적도 없이
   * 자리를 잃는다(다음 Tab이 페이지 맨 위로 돌아간다). 대본을 멈출 수는 없으니 — 멈추면 그
   * 장면을 못 본다 — **고른 탭으로 옮겨 준다.**
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
    document.getElementById(`${uid}-note-${NOTE_TABS.indexOf(tab)}`)?.focus();
  }, [tab, uid]);

  return (
    <div
      onFocus={() => {
        wasInside.current = true;
      }}
      onBlur={() => {
        wasInside.current = false;
      }}
      role="tabpanel"
      id={`${uid}-note-panel`}
      aria-labelledby={`${uid}-note-${NOTE_TABS.indexOf(tab)}`}
      className={`relative overflow-hidden ${compact ? "h-[372px]" : "h-[676px]"}`}
    >
      {/* `key`로 다시 마운트시켜 탭마다 새로 들게 한다 — 전이로는 같은 노드가 남아
          안 걸린다. 타임라인의 골라 보기도 이때 「전체」로 돌아간다. */}
      <div key={tab} data-panel className="h-full">
        {tab === "정보" ? (
          <DetailsPanel
            ended={demo.status === "종료됨"}
            at={at}
            compact={compact}
          />
        ) : null}
        {tab === "스크립트" ? (
          <TranscriptPanel
            lines={demo.lines}
            live={demo.live}
            ended={demo.status === "종료됨"}
            compact={compact}
          />
        ) : null}
        {tab === "타임라인" ? (
          <TimelinePanel
            entries={demo.entries}
            live={demo.live}
            status={demo.status}
            uid={uid}
            compact={compact}
          />
        ) : null}
        {tab === "요약" ? (
          <SummaryPanel
            status={demo.status}
            shown={demo.review}
            compact={compact}
          />
        ) : null}
      </div>
      <Dock
        status={demo.status}
        stopping={demo.stopping}
        at={at}
        compact={compact}
      />
    </div>
  );
}

/**
 * 녹음 독(`recording-dock.tsx`). 흰 알약 · 가는 테두리 · 그림자 —
 * `[Mic | 세로선 | 붉은 타이머 | 파형 막대 다섯 | ■ 중지]`. 중지되면 오른쪽 칸이 붉은 원
 * (재개)이 된다. **상단바에는 타이머가 없다** — 타이머는 독에만 있다.
 *
 * 타이머는 지금 말하는 줄의 시각이다. 대본은 회의를 몇 초로 줄여 보이므로, 따로 흐르는
 * 시계를 두면 스크립트의 시각과 어긋난다.
 *
 * 전부 그림이다 — ■는 대본이 누른다.
 */
function Dock({
  status,
  stopping,
  at,
  compact,
}: {
  status: Status;
  stopping: boolean;
  at: string;
  compact?: boolean;
}) {
  const gone = status === "종료됨";
  const cell = compact ? "size-[26px]" : "size-[30px]";
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 flex justify-center ${compact ? "bottom-3" : "bottom-5"}`}
    >
      <span
        aria-hidden={gone || undefined}
        data-gone={gone ? "" : undefined}
        className={`lp-dock flex items-center rounded-full border border-[var(--lp-rule)] bg-[var(--lp-card)] p-[3px] ${FLOAT_SHADOW} ${compact ? "h-8" : "h-9"}`}
      >
        <span
          className={`flex ${cell} items-center justify-center text-[var(--lp-muted)]`}
        >
          <Mic aria-hidden className={compact ? "size-3" : "size-3.5"} />
        </span>
        <span
          aria-hidden
          className="mx-0.5 h-4 w-px bg-[var(--lp-rule)]"
        />
        {status === "기록 중" ? (
          <span className="flex items-center gap-1.5 pr-0.5 pl-1.5">
            <span
              className={`font-mono font-semibold tabular-nums text-[var(--lp-rec-ink)] ${compact ? "min-w-8 text-[10px]" : "min-w-10 text-[11px]"}`}
            >
              {at}
            </span>
            <span
              aria-hidden
              className="mx-0.5 flex h-4 items-center gap-[2.5px]"
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  style={{ "--i": i } as React.CSSProperties}
                  className="lp-level block h-3.5 w-[2.5px] rounded-full bg-[var(--lp-rec)]"
                />
              ))}
            </span>
            <span
              data-pressing={stopping ? "" : undefined}
              className={`flex ${cell} items-center justify-center rounded-full text-[var(--lp-faint)]`}
            >
              <Square aria-hidden className="size-3" />
            </span>
          </span>
        ) : (
          <span
            className={`flex ${cell} items-center justify-center rounded-full bg-[var(--lp-rec)]`}
          >
            <span className="block size-2 rounded-full bg-[var(--lp-card)]" />
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * 정보 탭. **카드가 없다** — 위는 편집(제목 · 참석자 · 변경 저장), 아래는 읽기(회의 정보
 * 표)이고 그 구분은 컨트롤 테두리가 한다(`note-details.tsx`).
 *
 * 표는 **헤더가 말하지 않은 것만** 담는다. 회의 상태는 바로 위 상단바에 이미 있어서 여기
 * 다시 안 적는다. 그리고 위 셋(회의의 사실)과 아래 둘(문서의 이력) 사이에 선이 하나 있다.
 * 줄마다 밑줄을 긋지 않는다 — 앱의 `Fact`는 테두리가 없다.
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
        <span className="tabular-nums">{ended ? LENGTH : at}</span>
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
            {TITLE}
          </span>
        </Field>

        <Field label="참석자" compact={compact}>
          <div
            className={`flex flex-wrap items-center ${compact ? "gap-2" : "gap-2.5"}`}
          >
            <span className="flex items-center">
              {Object.keys(FACE_KEY).map((who, i) => (
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

/** 참석자 얼굴. 앱과 같은 `PersonAvatar`(beam)다 — **얼굴에 글자를 얹지 않는다.** */
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
    <PersonAvatar
      name={FACE_KEY[who]}
      size={compact ? 18 : 22}
      className={className}
    />
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
 * 받아 적는 줄을 「확정된 앞부분」과 「다음 조각이 갈아치울 뒷부분」으로 가른다 — 앱은 업체가
 * 확정한 앞부분을 진하게, 뒷부분을 옅게 그린다(`transcript-view.tsx`). 여기는 업체가 없으니
 * 끝의 몇 글자를 뒷부분으로 친다.
 */
function splitLive(text: string) {
  const cut = Math.max(0, text.length - 6);
  return [text.slice(0, cut), text.slice(cut)] as const;
}

/**
 * 스크립트 줄은 **두 칸 격자**다 — 왼쪽에 시각, 오른쪽에 (회의 뒤에만) 화자 한 줄과 그 아래
 * 본문(`note-archive.tsx`의 `grid-cols-[66px_1fr]`). 화자 이름을 본문 옆에 세우지 않는다.
 *
 * **받아 적는 중인 줄은 말풍선으로 선다**(앱의 partial 행 — 바탕이 깔리고 시각 자리에 붉은
 * 점과 「받아 적는 중」). 자리와 여백은 확정된 줄과 **똑같고** 배경과 모서리만 다르다 —
 * 확정되는 순간 색만 빠지므로 글자가 한 픽셀도 안 움직인다.
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
  /**
   * 이름이 아직 안 붙은 화자 수(앱 상단바의 「미지정 N」). 이 회의는 화자에 이름을 하나도 안
   * 붙인 채 끝나므로 말한 사람 수가 곧 그 수다 — 넷을 손으로 적으면 대본이 바뀔 때 어긋난다.
   */
  const unassigned = new Set(rows.map((row) => row.line.who)).size;
  const tool = `flex items-center gap-1.5 rounded-lg border ${compact ? "px-[9px] py-1" : "px-2.5 py-[5px]"}`;
  const toolIcon = `text-[#8a7a6d] ${compact ? "size-2.5" : "size-3"}`;
  const toolText = `font-medium text-[var(--lp-body)] ${compact ? "text-[9.5px]" : "text-[11px]"}`;
  const [scrollRef, onScroll] = useFollowBottom(
    [grew, rows.length, live?.text],
    grew
  );

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      // 바닥 여백은 녹음 독 몫이다 — 마지막 줄이 독 밑에 깔리지 않게.
      className={`h-full overflow-y-auto ${compact ? "px-[13px] pt-2.5 pb-14" : "px-5 pt-4 pb-20"}`}
    >
      <div className="flex items-center justify-end gap-1">
        {/* 화자 분리가 끝나면 앱은 복사 앞에 「화자」와, 이름 없는 화자가 있으면 「미지정 N」을
            둔다(`speaker-panel.tsx`의 `SpeakerTools` — 테두리 없는 ghost). 그림이다. */}
        {ended
          ? (
              [
                [Users, "화자"],
                [SkipForward, `미지정 ${unassigned}`],
              ] as const
            ).map(([Icon, label]) => (
              <span key={label} className={`${tool} border-transparent`}>
                <Icon aria-hidden className={toolIcon} />
                <span className={toolText}>{label}</span>
              </span>
            ))
          : null}
        <span className={`${tool} border-[var(--lp-rule)]`}>
          <Copy aria-hidden className={toolIcon} />
          <span className={toolText}>복사</span>
        </span>
      </div>
      <ul className={`m-0 list-none p-0 ${compact ? "" : "mt-1"}`}>
        {rows.map(({ line, typed }, i) => {
          const label = SPEAKER_LABEL[line.who];
          const [firm, soft] = splitLive(typed ?? "");
          return (
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
                // 좁은 화면의 시각 칸(34px)에는 「받아 적는 중」이 안 들어간다 — 붉은 점만 두고 이름은
                // 본문 아래로 내린다(타임라인의 받아 적는 줄과 같은 자리).
                <span
                  className={`flex items-center gap-1.5 whitespace-nowrap text-[var(--lp-muted)] ${compact ? "h-[19px] text-[9px]" : "pt-0.5 text-[10px]"}`}
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 animate-pulse rounded-full bg-[var(--lp-rec)]"
                  />
                  {compact ? null : "받아 적는 중"}
                </span>
              )}
              <div className="min-w-0">
                {/* **화자는 회의가 끝난 뒤에 붙는다.** 앱은 화자 매핑이 `MAPPED`가 돼야 칩을
                    그리고, 그 매핑은 종료 뒤에 돈다. 기록 중에는 시각과 본문뿐이다.

                    **붙는 것은 이름이 아니라 「화자 A」다.** 사람과 잇는 것은 그다음이고 그건
                    사용자가 한다(`speaker-identity.ts`의 `displayName`). 얼굴은 앱과 같은
                    `PersonAvatar`이고 **글자를 얹지 않는다**(`speaker-chip.tsx`). 뒤의 회색
                    점은 「아직 확인하지 않은 화자」 표시다 — 눈에 띄어야 이름을 붙일 이유가
                    생긴다. */}
                {ended ? (
                  <span
                    // 여덟이 한 프레임에 붙으면 「원래 있던 것」으로 읽힌다. 위에서부터
                    // 차례로 들어와야 **방금 갈렸다**가 보인다.
                    data-enter
                    style={{ "--i": i } as React.CSSProperties}
                    className={`inline-flex items-center gap-1.5 font-medium text-[var(--lp-muted)] ${compact ? "text-[10px]" : "text-[11px]"}`}
                  >
                    <PersonAvatar
                      name={unnamedSpeakerAvatarKey(label)}
                      size={compact ? 14 : 17}
                    />
                    화자 {label}
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
                  {typed === undefined ? (
                    line.text
                  ) : (
                    <>
                      {firm}
                      <span className="text-[var(--lp-body)]">{soft}</span>
                      <span aria-hidden className="lp-caret" />
                    </>
                  )}
                </p>
                {compact && typed !== undefined ? (
                  <span className="mt-1 block text-[9px] text-[var(--lp-muted)]">받아 적는 중</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── 타임라인 ───────────────────────────────────────────────────────────── */

/** 유형 이름의 색. 역할 색을 글자로 쓰면 흰 바탕에서 옅어서 한 단 진하게 둔다(앱의 `TONE_TEXT`). */
const KIND_TEXT: Record<TimelineTone, string> = {
  decision: "text-[var(--lp-role-decision-ink)]",
  task: "text-[var(--lp-role-task-ink)]",
  open: "text-[var(--lp-role-open-ink)]",
  answered: "text-[var(--lp-muted)]",
  reference: "text-[var(--lp-muted)]",
};

/** 항목 제목의 무게(앱의 `TONE_TITLE`). 답한 질문과 참고는 한 발 물러선다. */
const ENTRY_TITLE: Record<TimelineTone, string> = {
  decision: "font-medium text-[var(--lp-ink)]",
  task: "font-medium text-[var(--lp-ink)]",
  open: "text-[var(--lp-ink)]",
  answered: "text-[var(--lp-muted)]",
  reference: "text-[var(--lp-body)]",
};

const inFilter = (tone: TimelineTone, filter: Filter) =>
  filter === "전체" || FILTER_OF[tone] === filter;

/**
 * 펼친 카드의 관계 줄(`note-timeline.tsx`의 `relations`) — 질문 쪽은 「답」, 답이 된 쪽은
 * 「답한 질문」. 반대 방향은 적어 두지 않고 여기서 찾는다(`Entry.answer`).
 */
const relationsOf = (index: number) => {
  const answer = TIMELINE[index].answer;
  const question = TIMELINE.findIndex((e) => e.answer === index);
  return [
    ...(answer === undefined ? [] : [{ lead: "답", target: answer }]),
    ...(question < 0 ? [] : [{ lead: "답한 질문", target: question }]),
  ];
};

/** 앱 칩(`HeaderChip`) — h26 · r8 · 가는 테두리 · 12.5px. 문서 머리 둘이 같이 쓴다. */
function HeadChip({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-[22px] min-w-0 items-center gap-1 rounded-[7px] border border-[var(--lp-rule)] px-[7px] text-[10.5px] text-[var(--lp-body)]">
      {Icon ? (
        <Icon aria-hidden className="size-[11px] shrink-0 text-[var(--lp-muted)]" />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * 본문 「타임라인」 탭(`note-timeline.tsx`). 실시간 정리를 회의가 흘러간 순서로 읽는 면이다.
 *
 * **안건으로 묶는다.** 묶음 머리는 시간 구간 · 안건 제목 · 항목 수 · 펼침 화살표이고, 기록
 * 중인 마지막 안건에만 초록 「논의 중」과 「– 지금」이 붙는다 — 중지된 회의의 마지막 안건을
 * 지금 논의 중이라고 하면 거짓이다.
 *
 * **유형은 모양과 역할 색으로 말하고, 이름이 늘 옆에 선다** — 결정은 채운 체크, 할 일은 빈
 * 원, 열린 질문은 점선 원, 답한 질문은 회색 체크, 참고는 작은 점(`TimelineToneIcon`).
 *
 * **움직임이 없다.** 앱이 일부러 뺐다 — 회의 중에 계속 붙는 목록이라 움직이면 읽던 줄이
 * 흔들린다. 그래서 새 항목도 그냥 선다. 대신 끝을 읽고 있으면 바닥을 따라간다.
 *
 * 골라 보기 · 안건 접기 · 항목 펼치기는 진짜로 된다. 항목을 펼치면 근거 발화가 서고, 답한
 * 질문과 그 답이 된 항목에는 서로를 가리키는 관계 줄(「↗ 답」 · 「↗ 답한 질문」)이 붙는다 —
 * 질문이 「00:44에 답함」이라고 말해 놓고 펼친 카드에 그 답이 없으면 거짓이다. 관계 줄을
 * 누르면 그 항목으로 간다.
 */
function TimelinePanel({
  entries,
  live,
  status,
  uid,
  compact,
}: {
  entries: number;
  live: Demo["live"];
  status: Status;
  uid: string;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("전체");
  const [folded, setFolded] = useState<ReadonlySet<number>>(() => new Set());
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const toggle =
    (set: typeof setOpen) =>
    (index: number) =>
      set((current) => {
        const next = new Set(current);
        if (!next.delete(index)) next.add(index);
        return next;
      });
  const toggleFold = toggle(setFolded);
  const toggleOpen = toggle(setOpen);
  /** 관계 줄이 가리키다가 아직 화면에 안 데려간 항목. 펼쳐진 뒤에 재야 자리가 맞다. */
  const jumpTarget = useRef<number | null>(null);
  /**
   * 관계 줄이 가리키는 항목으로 간다 — 앱처럼 골라 보기와 접기를 풀고 펼쳐 둔 뒤 그 줄이 보이게
   * 패널을 민다(`note-timeline.tsx`의 `jumpTo`). 펼치기만 하면 좁은 화면의 372px 패널에서는
   * 대상이 화면 밖에 남아 간 것을 못 본다.
   */
  const jumpTo = (index: number) => {
    setFilter("전체");
    setFolded(new Set());
    // 늘 새 Set 이라 이미 펼친 항목이어도 다시 그려지고, 아래 효과가 그 뒤에 돈다.
    setOpen((current) => new Set(current).add(index));
    jumpTarget.current = index;
  };

  const recording = status === "기록 중";
  const shown = TIMELINE.slice(0, entries);
  // 드러난 것만 센다 — 아직 안 올라온 항목이 개수에만 미리 잡히면 칩이 거짓말을 한다.
  const count = (f: Filter) =>
    shown.filter((e) => e.tone && inFilter(e.tone, f)).length;

  /** 안건 소속은 순서로 정한다(`timeline.ts`의 `selectTimeline`). */
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
    if (inFilter(entry.tone, filter))
      current.items.push({ index, entry: { ...entry, tone: entry.tone } });
  });
  // 골라 보기 중에는 그 유형이 없는 안건을 감춘다. 「전체」에서는 항목이 없는 안건도 남긴다.
  const visible = groups.filter(
    (g) => filter === "전체" || g.items.length > 0
  );
  const last = groups[groups.length - 1];

  const [scrollRef, onScroll] = useFollowBottom([entries, live?.text]);
  // 대상 줄이 그려진 뒤 패널 안에서만 민다. `scrollIntoView`는 숨은 쪽 벌까지 페이지를 끌고
  // 가서 쓰지 않는다(`useFollowBottom`). 민 뒤의 스크롤 이벤트가 바닥 따라가기를 풀어 준다.
  useEffect(() => {
    const target = jumpTarget.current;
    if (target === null) return;
    jumpTarget.current = null;
    const panel = scrollRef.current;
    const row = panel?.querySelector<HTMLElement>(`[data-entry="${target}"]`);
    if (panel && row) {
      panel.scrollTop += row.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12;
    }
  }, [open, scrollRef]);
  const [firm, soft] = splitLive(live?.text ?? "");
  const cols = compact
    ? "grid-cols-[30px_26px_minmax(0,1fr)]"
    : "grid-cols-[38px_34px_minmax(0,1fr)]";

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className={`h-full overflow-y-auto ${compact ? "px-[13px] pt-3 pb-14" : "px-10 pt-7 pb-20"}`}
    >
      {/* 문서 머리. 좁은 화면은 상단바가 이미 제목을 말하므로 뺀다. */}
      {compact ? null : (
        <div className="mb-6">
          <p className="m-0 font-serif text-[24px] font-medium leading-[32px] tracking-[-0.4px] text-[var(--lp-ink)]">
            {TITLE}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <HeadChip icon={Calendar}>2026년 9월 1일 오후 2:00</HeadChip>
            <HeadChip icon={Users}>4명</HeadChip>
            <HeadChip icon={Folder}>{PROJECT}</HeadChip>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--lp-rule-soft)] pb-2">
        {/* `aria-pressed`로 눌린 상태를 말한다 — 라벨과 개수가 다른 요소라 그냥 두면
            「전체7」로 읽힌다. */}
        <div
          role="group"
          aria-label="유형으로 골라 보기"
          className="flex flex-wrap items-center gap-0.5"
        >
          {FILTERS.map((f) => {
            const on = f === filter;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                aria-label={`${f} ${count(f)}`}
                onClick={() => setFilter(f)}
                className={`inline-flex h-6 items-center gap-1 rounded-[6px] transition-colors ${
                  compact ? "px-1.5 text-[10px]" : "px-[7px] text-[11px]"
                } ${
                  on
                    ? "bg-[var(--lp-rule-soft)] font-medium text-[var(--lp-ink)]"
                    : "text-[var(--lp-muted)] hover:bg-[var(--lp-canvas)] hover:text-[var(--lp-ink)]"
                }`}
              >
                {f}
                <span className="text-[10px] font-normal tabular-nums text-[var(--lp-faint)]">
                  {count(f)}
                </span>
              </button>
            );
          })}
        </div>
        <p
          className={`m-0 text-[var(--lp-faint)] ${compact ? "text-[9.5px]" : "text-[10.5px]"}`}
        >
          {status === "종료됨"
            ? "이 회의에서 남길 만한 변화만 기록했습니다"
            : "말이 끝날 때마다 정리됩니다 · 방금 갱신"}
        </p>
      </div>

      {visible.map((group) => {
        const isFolded = folded.has(group.index);
        const listId = `${uid}-agenda-${group.index}`;
        const range = group.end
          ? `${group.agenda.at} – ${group.end}`
          : group === last && recording
            ? `${group.agenda.at} – 지금`
            : group.agenda.at;
        return (
          <div key={group.index} className={compact ? "mt-4" : "mt-6"}>
            <div className="-mx-1.5 flex h-[26px] items-center gap-0.5">
              {/* 시간 구간 — 앱에서는 스크립트로 가는 버튼이다. 여기서는 갈 곳이 없어 그림이다. */}
              <span
                className={`shrink-0 px-1.5 tabular-nums text-[var(--lp-faint)] ${compact ? "text-[9.5px]" : "text-[10.5px]"}`}
              >
                {range}
              </span>
              <button
                type="button"
                aria-expanded={!isFolded}
                aria-controls={listId}
                onClick={() => toggleFold(group.index)}
                className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-[6px] pr-1.5 pl-1 text-left transition-colors hover:bg-[var(--lp-canvas)]"
              >
                <span
                  className={`min-w-0 truncate font-semibold text-[var(--lp-ink)] ${compact ? "text-[11.5px]" : "text-[13px]"}`}
                >
                  {group.agenda.title}
                </span>
                <span
                  className={`-ml-1 shrink-0 tabular-nums text-[var(--lp-faint)] ${compact ? "text-[10px]" : "text-[11px]"}`}
                >
                  {group.total}
                </span>
                <ChevronRight
                  aria-hidden
                  className={`-ml-1.5 size-3 shrink-0 text-[var(--lp-faint)] ${isFolded ? "" : "rotate-90"}`}
                />
                <span className="flex-1" />
                {group === last && recording ? (
                  <span className="inline-flex h-[19px] shrink-0 items-center gap-1 rounded-[5px] bg-[color-mix(in_srgb,var(--lp-success)_10%,transparent)] px-1.5 text-[10px] text-[var(--lp-success-ink)]">
                    <span
                      aria-hidden
                      className="size-[5px] rounded-full bg-[var(--lp-success)]"
                    />
                    논의 중
                  </span>
                ) : null}
              </button>
            </div>
            {/* 접혀도 목록을 DOM에 남긴다 — 지우면 `aria-controls`가 없는 id를 가리킨다. */}
            <ol
              id={listId}
              hidden={isFolded}
              // 묶음 전체를 꿰는 세로선. 아이콘 칸 한가운데를 지난다.
              className={`relative m-0 mt-1 list-none p-0 before:absolute before:top-3 before:bottom-3 before:w-px before:bg-[var(--lp-rule)] before:content-[''] ${compact ? "before:left-[42.5px]" : "before:left-[54.5px]"}`}
            >
              {group.items.map(({ index, entry }) => {
                const isOpen = open.has(index);
                const detailsId = `${uid}-entry-${index}`;
                return (
                  <li
                    key={index}
                    data-entry={index}
                    className={`relative grid ${cols} ${compact ? "py-[5px]" : "py-[6px]"}`}
                  >
                    <span
                      className={`text-right tabular-nums text-[var(--lp-faint)] ${compact ? "text-[9.5px] leading-[19px]" : "text-[10.5px] leading-[21px]"}`}
                    >
                      {entry.at}
                    </span>
                    <span className="flex justify-center pt-[3px]">
                      {/* 흰 바탕이 세로선을 끊어 아이콘이 선 위에 얹힌다. */}
                      <span
                        className={`inline-flex rounded-full bg-[var(--lp-card)] ${compact ? "[&_svg]:size-3" : "[&_svg]:size-3.5"}`}
                      >
                        <TimelineToneIcon tone={entry.tone} />
                      </span>
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={detailsId}
                        onClick={() => toggleOpen(index)}
                        className="-ml-1.5 grid w-[calc(100%+6px)] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 rounded-[6px] px-1.5 text-left transition-colors hover:bg-[var(--lp-canvas)]"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span
                            className={`break-keep ${ENTRY_TITLE[entry.tone]} ${compact ? "text-[11.5px] leading-[19px]" : "text-[13px] leading-[21px]"}`}
                          >
                            {entry.title}
                          </span>
                          <span
                            className={`text-[var(--lp-muted)] ${compact ? "text-[9.5px] leading-[15px]" : "text-[10.5px] leading-4"}`}
                          >
                            <span className={KIND_TEXT[entry.tone]}>
                              {entry.kind}
                            </span>
                            {entry.meta ? (
                              <>
                                <span
                                  aria-hidden
                                  className="mx-1 text-[var(--lp-rule-strong)]"
                                >
                                  ·
                                </span>
                                {entry.meta}
                              </>
                            ) : null}
                          </span>
                        </span>
                        <ChevronDown
                          aria-hidden
                          className={`mt-[3px] size-3.5 text-[var(--lp-rule-strong)] ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {/* 관계 줄이 카드 끝까지 깔리도록 안쪽 여백은 근거 묶음에만 준다. */}
                      <div
                        id={detailsId}
                        hidden={!isOpen}
                        className="mt-2 mb-1 overflow-hidden rounded-[9px] border border-[var(--lp-rule)]"
                      >
                        {entry.cites?.length ? (
                          <div className="px-1.5 py-1.5">
                            {entry.cites.map((i) => (
                              <p
                                key={i}
                                className="m-0 grid grid-cols-[34px_minmax(0,1fr)] gap-x-2 px-1 py-0.5"
                              >
                                <span className="text-[10px] leading-[19px] tabular-nums text-[var(--lp-faint)]">
                                  {TRANSCRIPT[i].at}
                                </span>
                                <span
                                  className={`break-keep text-[var(--lp-body)] ${compact ? "text-[10.5px] leading-[17px]" : "text-[11.5px] leading-[19px]"}`}
                                >
                                  {TRANSCRIPT[i].text}
                                </span>
                              </p>
                            ))}
                          </div>
                        ) : null}
                        {relationsOf(index).map(({ lead, target }) => (
                          <button
                            key={lead}
                            type="button"
                            onClick={() => jumpTo(target)}
                            className={`flex w-full items-center gap-1.5 bg-[var(--lp-canvas)] px-2.5 py-1.5 text-left text-[10.5px] text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-ink)] ${entry.cites?.length ? "border-t border-[var(--lp-rule-soft)]" : ""}`}
                          >
                            <ArrowUpRight
                              aria-hidden
                              className="size-3 shrink-0"
                            />
                            <span className="shrink-0">{lead}</span>
                            <span className="min-w-0 truncate text-[var(--lp-ink)]">
                              {TIMELINE[target].title}
                            </span>
                            <span className="flex-1" />
                            <span className="shrink-0 tabular-nums text-[var(--lp-faint)]">
                              {TIMELINE[target].at}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}

      {/* 받아 적는 중인 발화. 확정 앞부분은 진하게, 뒷부분은 옅게 — 스크립트 탭의 같은 줄과
          같은 규칙이다. 화자 칸은 없다(분리는 회의 뒤에 끝난다). **정리해 붙인다고 약속하지
          않는다** — 대부분의 말은 항목이 되지 않는다(`note-timeline.tsx`). */}
      {live && recording ? (
        <div
          className={`grid ${cols} border-t border-dashed border-[var(--lp-rule)] ${compact ? "mt-3 pt-3" : "mt-4 pt-3.5"}`}
        >
          <span />
          <span className="flex justify-center pt-[7px]">
            <span className="size-1.5 rounded-full bg-[var(--lp-rec)]" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span
              className={`break-keep text-[var(--lp-faint)] ${compact ? "text-[11.5px] leading-[19px]" : "text-[13px] leading-[21px]"}`}
            >
              <span className="text-[var(--lp-muted)]">{firm}</span>
              {soft}
              <span aria-hidden className="lp-caret" />
            </span>
            <span
              className={`text-[var(--lp-muted)] ${compact ? "text-[9.5px] leading-[15px]" : "text-[10.5px] leading-4"}`}
            >
              받아 적는 중
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ── 요약 ───────────────────────────────────────────────────────────────── */

/**
 * 요약 탭(`review-tab.tsx`). 셋 중 하나다 — 회의가 끝나기 전의 회색 안내, 끝난 직후의 분석
 * 대기(`flow-notice.tsx`), 분석이 끝난 뒤의 검토 문서(`review-board.tsx`). 문구는 앱 것
 * 그대로다.
 */
function SummaryPanel({
  status,
  shown,
  compact,
}: {
  status: Status;
  shown: number;
  compact?: boolean;
}) {
  if (status !== "종료됨") {
    return (
      <div className={compact ? "px-[13px] py-3.5" : "px-5 py-5"}>
        <div
          className={`rounded-xl border border-[var(--lp-rule)] bg-[var(--lp-canvas)] ${compact ? "p-3.5" : "p-5"}`}
        >
          <p
            className={`m-0 font-medium text-[var(--lp-ink)] ${compact ? "text-[11.5px]" : "text-[13px]"}`}
          >
            요약은 회의가 끝나면 정리됩니다
          </p>
          <p
            className={`m-0 mt-1.5 break-keep leading-[1.6] text-[var(--lp-muted)] ${compact ? "text-[10px]" : "text-[11.5px]"}`}
          >
            회의를 끝내면 결정 · 할 일 · 이슈를 주제로 묶어 검토할 수 있게
            됩니다.
          </p>
        </div>
      </div>
    );
  }
  return shown === 0 ? (
    <Analyzing compact={compact} />
  ) : (
    <ReviewDoc shown={shown} compact={compact} />
  );
}

const STEPS = ["화자 나누기", "분석", "검토", "확정"];

/**
 * 분석 대기(`flow-notice.tsx`의 ANALYZING). 화자 나누기는 끝났고(그래서 스크립트에 화자 칩이
 * 붙었다) 분석이 도는 중이다. **스피너 + 왜 기다리는지 한 줄** — 끝나는 시각이 정해지지 않은
 * 서버 작업이라 skeleton으로 그리지 않는다(`error-loading.md`). 대본은 이 몇 분을 1.7초로
 * 줄여 보인다.
 */
function Analyzing({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "px-[13px] pt-5" : "px-10 pt-9"}>
      <ol
        aria-label="분석 단계"
        className={`m-0 flex list-none flex-wrap items-center p-0 ${compact ? "gap-2.5 text-[10px]" : "gap-2 text-[10.5px]"}`}
      >
        {STEPS.map((label, at) => {
          const done = at === 0;
          const now = at === 1;
          return (
            <li
              key={label}
              aria-label={`${label}: ${done ? "완료" : now ? "진행 중" : "대기"}`}
              className="flex items-center gap-2"
            >
              {/* 좁은 화면은 잇는 선을 뺀다 — 앱도 `sm` 아래에서 뺀다. */}
              {at > 0 && !compact ? (
                <span
                  aria-hidden
                  className={`h-px w-6 ${at <= 1 ? "bg-[var(--lp-rule-strong)]" : "bg-[var(--lp-rule)]"}`}
                />
              ) : null}
              <span
                aria-current={now ? "step" : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap ${
                  done
                    ? "text-[var(--lp-body)]"
                    : now
                      ? "font-semibold text-[var(--lp-ink)]"
                      : "text-[var(--lp-faint)]"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-flex size-[17px] shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold ${
                    done
                      ? "border-[var(--lp-ink)] bg-[var(--lp-ink)] text-[var(--lp-card)]"
                      : now
                        ? "border-[var(--lp-rule-strong)] text-[var(--lp-ink)]"
                        : "border-[var(--lp-rule-strong)] text-[var(--lp-faint)]"
                  }`}
                >
                  {done ? (
                    <Check className="size-2.5" strokeWidth={3} />
                  ) : now ? (
                    <LoaderCircle className="size-2.5 animate-spin" />
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

      <div
        className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 ${compact ? "mt-6" : "mt-10"}`}
      >
        <LoaderCircle
          aria-hidden
          className="mt-[3px] size-[15px] animate-spin text-[var(--lp-muted)]"
        />
        <span
          className={`font-medium text-[var(--lp-ink)] ${compact ? "text-[12.5px]" : "text-[14.5px]"}`}
        >
          회의를 분석하는 중입니다
        </span>
        <p
          className={`col-start-2 m-0 break-keep leading-[1.6] text-[var(--lp-muted)] ${compact ? "text-[10.5px]" : "text-[12px]"}`}
        >
          결정과 할 일을 주제로 묶고, 담당과 기한을 붙이고, 프로젝트의 기존
          결정 · 할 일과 견줍니다. 몇 분 걸릴 수 있고, 다른 화면으로 옮겨도
          됩니다.
        </p>
      </div>
    </div>
  );
}

const seconds = (at: string) => {
  const [m, s] = at.split(":").map(Number);
  return m * 60 + s;
};
/** 회의 길이 위의 자리(`meeting-map.tsx`의 `at`). */
const onTrack = (at: string) => `${(seconds(at) / seconds(LENGTH)) * 100}%`;

/** 섹션 머리(`section-block.tsx`) — 제목 · 회색 개수 · 오른쪽 끝 복사. */
function SectionHead({
  title,
  count,
  aside,
  compact,
}: {
  title: string;
  count?: number;
  aside?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="flex h-6 items-center justify-between gap-3">
      <p
        className={`m-0 flex items-baseline gap-1.5 font-semibold text-[var(--lp-ink)] ${compact ? "text-[12px]" : "text-[13.5px]"}`}
      >
        {title}
        {count === undefined ? null : (
          <span className="text-[11px] font-normal tabular-nums text-[var(--lp-faint)]">
            {count}
          </span>
        )}
      </p>
      <span className="flex items-center gap-2">
        {aside}
        <Copy aria-hidden className="size-3 text-[var(--lp-faint)]" />
      </span>
    </div>
  );
}

/**
 * 검토 문서(`review-board.tsx`, APP-865) — 회의록 문서 한 단이다. 머리 → 「언제 정해졌나」
 * → 요약 → 주제 → 결정 → 할 일, 그리고 아래 가운데에 떠 있는 검토 막대. **「검토 완료」를
 * 눌러야 결정과 할 일이 프로젝트에 올라간다** — 그 막대까지가 이 장면이다.
 *
 * 묶음이 하나씩 선다(대본의 `review`). 문서가 패널보다 길어서, 새 묶음이 서면 바닥을
 * 따라간다 — 위를 읽으려고 올린 사람은 그대로 둔다.
 *
 * 전부 그림이다. 이 랜딩에서 고칠 담당도, 올릴 프로젝트도 없다.
 */
function ReviewDoc({ shown, compact }: { shown: number; compact?: boolean }) {
  const [scrollRef, onScroll] = useFollowBottom([shown]);
  const marks = [
    ...REVIEW.decisions.map((d) => ({ at: d.at, color: "var(--lp-role-decision)" })),
    ...REVIEW.tasks.map((t) => ({ at: t.at, color: "var(--lp-role-task)" })),
  ];
  const body = compact ? "text-[11.5px]" : "text-[13px]";
  const gap = compact ? "pt-6" : "pt-8";

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      // `scroll-smooth`를 안 건다 — 미끄러지는 동안 오는 스크롤 이벤트가 「바닥에서 멀어졌다」로
      // 읽혀 따라가기가 꺼지고, 다음 묶음이 패널 밖에 선다. 새 묶음은 `data-enter`로 든다.
      className="flex h-full flex-col overflow-y-auto"
    >
      <div
        className={`flex-1 ${compact ? "px-[13px] pt-3.5 pb-4" : "px-10 pt-6 pb-6"}`}
      >
        <div data-enter>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-[18px] items-center rounded-[5px] bg-[var(--lp-rule-soft)] px-1.5 text-[10px] font-semibold text-[var(--lp-body)]">
              검토 중
            </span>
            {/* 요약 / 그래프 전환(`SegmentedControl`) — 그림이다. */}
            <span className="ml-auto inline-flex h-6 items-center rounded-full bg-[var(--lp-rule-soft)] p-[2px] text-[10.5px] font-medium">
              <span className="rounded-full bg-[var(--lp-card)] px-2.5 py-[2px] text-[var(--lp-ink)] shadow-[0_1px_2px_#33231a14]">
                요약
              </span>
              <span className="px-2.5 text-[var(--lp-muted)]">그래프</span>
            </span>
          </div>
          <p
            className={`m-0 mt-2 font-serif font-medium tracking-[-0.4px] text-[var(--lp-ink)] ${compact ? "text-[19px] leading-[26px]" : "text-[24px] leading-[32px]"}`}
          >
            {TITLE}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <HeadChip icon={CalendarDays}>9월 1일 (화) 오후 2:00</HeadChip>
            <HeadChip icon={Clock}>2분</HeadChip>
            {/* 참석자는 **노트의 참석자**다(`ReviewHead`의 `note.participants`) — 화자 라벨이
                아니다. 화자에 이름을 안 붙인 채 끝난 회의라도 참석자는 정보 탭의 그 넷이고,
                얼굴도 같다. 담당 칸만 화자 라벨이다. */}
            <span className="inline-flex h-[22px] items-center gap-1 rounded-[7px] border border-[var(--lp-rule)] pr-[7px] pl-[3px] text-[10.5px] text-[var(--lp-body)]">
              <span className="flex">
                {Object.keys(FACE_KEY).map((who, i) => (
                  <PersonAvatar
                    key={who}
                    name={FACE_KEY[who]}
                    size={15}
                    className={`ring-[1.5px] ring-[var(--lp-card)] ${i > 0 ? "-ml-1" : ""}`}
                  />
                ))}
              </span>
              김민서 외 3명
            </span>
            <HeadChip icon={Folder}>{PROJECT}</HeadChip>
          </div>

          {/* 「언제 정해졌나」(`meeting-map.tsx`). 회의 길이 위에 주제 구간을 깔고 결정 · 할
              일이 나온 때를 색 막대로 찍는다. */}
          <div
            className={`rounded-[10px] border border-[var(--lp-rule-soft)] px-3.5 pt-2.5 pb-1.5 ${compact ? "mt-4" : "mt-5"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-[var(--lp-muted)]">
              <span className="font-medium text-[var(--lp-body)]">
                언제 정해졌나
              </span>
              <span className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden
                    className="h-[5px] w-2.5 rounded-[2px] bg-[var(--lp-rule)]"
                  />
                  주제 구간
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <span
                    aria-hidden
                    className="h-2 w-[3px] rounded-[2px] bg-[var(--lp-role-decision)]"
                  />
                  결정 {REVIEW.decisions.length}
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <span
                    aria-hidden
                    className="h-2 w-[3px] rounded-[2px] bg-[var(--lp-role-task)]"
                  />
                  할 일 {REVIEW.tasks.length}
                </span>
              </span>
            </div>
            <div aria-hidden className="relative mt-1.5 h-[22px]">
              {REVIEW.topics.map((topic, i) => {
                const end = REVIEW.topics[i + 1]?.at ?? LENGTH;
                return (
                  <span
                    key={topic.at}
                    className="absolute top-2 h-[5px] rounded-[2px] bg-[var(--lp-rule)]"
                    style={{
                      left: onTrack(topic.at),
                      width: `calc(${(seconds(end) - seconds(topic.at)) / seconds(LENGTH) * 100}% - 2px)`,
                    }}
                  />
                );
              })}
              {marks.map((mark) => (
                <span
                  key={mark.at}
                  className="absolute top-[5px] -ml-[1.5px] h-3 w-[3px] rounded-[2px]"
                  style={{ left: onTrack(mark.at), background: mark.color }}
                />
              ))}
            </div>
            <div
              aria-hidden
              className="flex justify-between text-[9.5px] tabular-nums text-[var(--lp-faint)]"
            >
              <span>0:00</span>
              <span>2분</span>
            </div>
          </div>

          <div className={compact ? "pt-5" : "pt-7"}>
            <SectionHead title="요약" compact={compact} />
            <p
              className={`m-0 mt-1.5 break-keep leading-[1.8] text-[var(--lp-body)] ${body}`}
            >
              {REVIEW.summary}
            </p>
          </div>
        </div>

        {shown > 1 ? (
          <div data-enter className={gap}>
            <SectionHead
              title="주제"
              count={REVIEW.topics.length}
              compact={compact}
            />
            <ul className="m-0 mt-1.5 list-none border-t border-[var(--lp-rule-soft)] p-0">
              {REVIEW.topics.map((topic) => (
                <li
                  key={topic.at}
                  className={`grid items-start gap-x-2.5 border-b border-[var(--lp-rule-soft)] py-2.5 ${compact ? "grid-cols-[34px_minmax(0,1fr)_auto]" : "grid-cols-[46px_minmax(0,1fr)_auto_14px]"}`}
                >
                  <span className="text-[10.5px] leading-5 tabular-nums text-[var(--lp-faint)]">
                    {topic.at}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={`break-keep font-medium leading-5 text-[var(--lp-ink)] ${body}`}
                    >
                      {topic.title}
                    </span>
                    <span
                      className={`truncate text-[var(--lp-muted)] ${compact ? "text-[10.5px] leading-4" : "text-[11.5px] leading-[17px]"}`}
                    >
                      {topic.gist}
                    </span>
                  </span>
                  <span className="flex h-5 items-center gap-2 text-[10.5px] tabular-nums text-[var(--lp-muted)]">
                    {topic.counts.map(([tone, n]) => (
                      <span
                        key={tone}
                        className="inline-flex items-center gap-0.5 [&_svg]:size-3.5"
                      >
                        <TimelineToneIcon tone={tone} />
                        <span className="sr-only">
                          {tone === "decision"
                            ? "결정"
                            : tone === "task"
                              ? "할 일"
                              : "열린 질문"}{" "}
                        </span>
                        {n}
                      </span>
                    ))}
                  </span>
                  {compact ? null : (
                    <ChevronDown
                      aria-hidden
                      className="mt-[3px] size-3.5 text-[var(--lp-faint)]"
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {shown > 2 ? (
          <div data-enter className={gap}>
            <SectionHead
              title="결정"
              count={REVIEW.decisions.length}
              compact={compact}
            />
            <div className="mt-1.5">
              {REVIEW.decisions.map((decision, i) => {
                // 첫 줄은 펼친 채로 둔다 — 줄 아래 근거 발언이 이 화면의 요점이다.
                const open = i === 0;
                return (
                  <div
                    key={decision.at}
                    className="border-b border-[var(--lp-rule-soft)]"
                  >
                    <div
                      className={`-mx-1.5 grid grid-cols-[14px_minmax(0,1fr)_auto_14px] items-center gap-x-2.5 rounded-[7px] px-1.5 py-[9px] ${open ? "bg-[var(--lp-rule-soft)]" : ""}`}
                    >
                      <span className="flex [&_svg]:size-3.5">
                        <TimelineToneIcon tone="decision" />
                      </span>
                      <span
                        className={`min-w-0 leading-5 text-[var(--lp-ink)] ${body} ${open ? "break-keep font-semibold" : "truncate"}`}
                      >
                        {decision.text}
                      </span>
                      <span className="flex items-center justify-end gap-2.5">
                        {/* 주제 제목은 좁은 화면에서 뺀다 — 앱도 `sm` 아래에서 감춘다. */}
                        {compact ? null : (
                          <span className="max-w-[150px] truncate text-[10.5px] text-[var(--lp-faint)]">
                            {decision.topic}
                          </span>
                        )}
                        <span className="inline-flex h-[19px] items-center rounded-[5px] bg-[var(--lp-canvas)] px-1.5 text-[10px] tabular-nums text-[var(--lp-body)]">
                          {decision.at}
                        </span>
                      </span>
                      <ChevronDown
                        aria-hidden
                        className={`size-3.5 ${open ? "rotate-180 text-[var(--lp-ink)]" : "text-[var(--lp-faint)]"}`}
                      />
                    </div>
                    {open ? (
                      <div className="pt-2 pb-3">
                        {/* 근거 발언(`evidence-quotes.tsx`) — 화자 얼굴 · 「화자 A · 00:00」 · 그
                            발화. 화자는 이름이 안 붙어 라벨이다. */}
                        <ul
                          aria-label="근거 발언"
                          className="m-0 flex list-none flex-col gap-1 rounded-[9px] border border-[var(--lp-rule)] px-1.5 py-1"
                        >
                          {decision.cites.map((at) => {
                            const line = TRANSCRIPT[at];
                            const label = SPEAKER_LABEL[line.who];
                            return (
                              <li
                                key={at}
                                className="grid grid-cols-[17px_minmax(0,1fr)] gap-x-2 px-1.5 py-1.5"
                              >
                                <span className="pt-0.5">
                                  <PersonAvatar
                                    name={unnamedSpeakerAvatarKey(label)}
                                    size={17}
                                  />
                                </span>
                                <span className="flex min-w-0 flex-col">
                                  <span className="text-[10.5px] leading-4 text-[var(--lp-faint)]">
                                    <span className="font-medium text-[var(--lp-body)]">
                                      화자 {label}
                                    </span>
                                    {" · "}
                                    <span className="tabular-nums">
                                      {line.at}
                                    </span>
                                  </span>
                                  <span
                                    className={`break-keep text-[var(--lp-ink)] ${compact ? "text-[10.5px] leading-[17px]" : "text-[12px] leading-[19px]"}`}
                                  >
                                    {line.text}
                                  </span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        <span className="mt-2 flex gap-1.5">
                          {["수정", "제외"].map((label) => (
                            <span
                              key={label}
                              className="inline-flex h-6 items-center rounded-[6px] border border-[var(--lp-rule)] px-2 text-[10.5px] font-medium text-[var(--lp-body)]"
                            >
                              {label}
                            </span>
                          ))}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {shown > 3 ? (
          <div data-enter className={gap}>
            <SectionHead
              title="할 일"
              count={REVIEW.tasks.length}
              compact={compact}
              aside={
                // 앱은 이 줄을 담당이 이름 없는 화자인 할 일이 있을 때만 세운다.
                compact ? null : (
                  <>
                    <span className="text-[10.5px] text-[var(--lp-muted)]">
                      이름 없는 화자에게 걸린 할 일 {REVIEW.tasks.length}
                    </span>
                    <span className="inline-flex h-[22px] items-center rounded-full border border-[var(--lp-rule-strong)] px-2 text-[10px] font-medium text-[var(--lp-ink)]">
                      화자 이름 붙이기
                    </span>
                  </>
                )
              }
            />
            <div className="mt-1.5">
              {REVIEW.tasks.map((task) => (
                <div
                  key={task.at}
                  className={`grid items-center gap-x-2.5 border-b border-[var(--lp-rule-soft)] py-[9px] ${compact ? "grid-cols-[14px_minmax(0,1fr)_14px] gap-y-1.5" : "grid-cols-[14px_minmax(0,1fr)_92px_112px_14px]"}`}
                >
                  <span
                    aria-hidden
                    className="size-3.5 rounded-[3px] border-[1.5px] border-[var(--lp-rule-strong)]"
                  />
                  <span
                    className={`min-w-0 truncate leading-5 text-[var(--lp-ink)] ${body}`}
                  >
                    {task.text}
                  </span>
                  {/* 좁은 화면은 담당 · 기한이 둘째 줄로 내려간다(`review-row.tsx`). */}
                  <span
                    className={
                      compact
                        ? "col-start-2 row-start-2 flex items-center gap-3"
                        : "contents"
                    }
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--lp-body)]">
                      <PersonAvatar
                        name={unnamedSpeakerAvatarKey(task.who)}
                        size={15}
                      />
                      화자 {task.who}
                    </span>
                    {task.due ? (
                      <span className="inline-flex h-[22px] w-fit items-center gap-1 rounded-[6px] bg-[var(--lp-canvas)] px-1.5 text-[10.5px] text-[var(--lp-body)]">
                        <CalendarDays
                          aria-hidden
                          className="size-3 text-[var(--lp-muted)]"
                        />
                        {task.due}
                      </span>
                    ) : (
                      // 비어 있는 기한은 주황 점선 — 정해야 할 것이 남았다는 표시다.
                      <span className="inline-flex h-[22px] w-fit items-center rounded-[6px] border border-dashed border-[color-mix(in_srgb,var(--lp-role-open)_45%,white)] px-1.5 text-[10.5px] text-[var(--lp-role-open-ink)]">
                        기한 정하기
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={`size-3.5 text-[var(--lp-faint)] ${compact ? "col-start-3 row-start-1" : ""}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* 검토 막대(`confirm-bar.tsx`) — 아래 가운데에 붙어 있고, 위로 흰 그라데이션이 깔려
          글이 막대 뒤로 스며 사라진다. 「검토 완료」는 그림이다. */}
      {shown >= REVIEW_PARTS ? (
        <div
          data-enter
          className={`pointer-events-none sticky bottom-0 flex justify-center ${compact ? "px-[13px] pb-3" : "px-10 pb-4"}`}
        >
          <span
            aria-hidden
            className="absolute inset-x-0 -top-8 bottom-0 bg-gradient-to-b from-transparent to-[var(--lp-card)] to-60%"
          />
          <span
            className={`relative flex min-h-[42px] max-w-full items-center gap-x-3 rounded-[12px] border border-[var(--lp-rule)] bg-[var(--lp-card)] py-[6px] pr-[6px] ${FLOAT_SHADOW} ${compact ? "pl-3" : "pl-[15px]"}`}
          >
            <span
              className={`break-keep text-[var(--lp-body)] ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}
            >
              결정{" "}
              <span className="font-semibold text-[var(--lp-ink)]">
                {REVIEW.decisions.length}
              </span>
              개와 할 일{" "}
              <span className="font-semibold text-[var(--lp-ink)]">
                {REVIEW.tasks.length}
              </span>
              개를 프로젝트에 올립니다
            </span>
            <span aria-hidden className="h-4 w-px shrink-0 bg-[var(--lp-rule)]" />
            <span className="inline-flex h-[30px] shrink-0 items-center rounded-[8px] bg-[var(--lp-dark)] px-3.5 text-[11px] font-medium text-[var(--lp-on-dark)]">
              검토 완료
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ── 내 에이전트 ─────────────────────────────────────────────────────────── */

/**
 * 오른쪽 레일(`note-agent-rail.tsx`). **탭이 없다** — 「내 에이전트」 하나다. 머리 한 줄이
 * 이 화면의 요점이다: 남의 눈에 안 보인다는 사실은 화면 어디에도 다시 안 나온다.
 *
 * 레일 접기(`PanelRightClose`)는 그림이다. 접었을 때 뜨는 「이 회의에 대해 물어보기」 알약은
 * 이 목업에 안 그린다 — 레일이 늘 펴져 있으니 설 자리가 없다.
 */
function AgentRail({ demo, compact }: { demo: Demo; compact?: boolean }) {
  return (
    <>
      {/* 넓은 화면은 상단바와 같은 h-14 — 두 기둥의 바닥선이 맞아야 한 창으로 읽힌다. */}
      <div
        className={`flex shrink-0 items-center gap-2 border-b border-[var(--lp-rule-soft)] ${compact ? "h-11 pr-2 pl-[13px]" : "h-14 pr-3 pl-4"}`}
      >
        <Sparkles
          aria-hidden
          className="size-[13px] shrink-0 text-[var(--lp-ink)]"
        />
        <span className="shrink-0 text-[12px] font-semibold text-[var(--lp-ink)]">
          내 에이전트
        </span>
        <span
          className={`min-w-0 truncate text-[var(--lp-faint)] ${compact ? "text-[10px]" : "text-[10.5px]"}`}
        >
          나만 보는 대화 · 현재 회의 범위
        </span>
        <span className="flex-1" />
        <span className="flex size-7 shrink-0 items-center justify-center text-[var(--lp-muted)]">
          <PanelRightClose aria-hidden className="size-[14px]" />
        </span>
      </div>
      <AgentPanel
        compact={compact}
        turns={demo.turns}
        typing={demo.typing}
        typingAt={demo.typingAt}
        ask={demo.ask}
      />
    </>
  );
}

/**
 * 개인 챗(`personal-chat.tsx` · `chat-thread.tsx`).
 *
 * **여기서 실제로 물어볼 수 있다.** 준비된 질문을 누르면 답이 흐르고 참고한 회의록이
 * 붙는다. 입력창을 열어 두고 아무 문장이나 받는 쪽이 더 그럴듯하지만, 그러려면 비로그인
 * 질의를 받는 서버가 있어야 하고 없이 흉내만 내면 「사실 대조판」이 첫 화면부터 거짓이 된다.
 * 그래서 **답이 실제로 있는 질문만** 내고, 입력창은 그림이다.
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
  const text = compact ? "text-[10.5px]" : "text-[11.5px]";
  /**
   * 스크린 리더에 읽어 줄 것. **방문자가 보낸 질문의 답만, 다 흐른 뒤에 한 번이다.** 대화 전체를
   * live 영역으로 두면 아무도 안 누른 대본의 질의(질문 · 「생각하는 중」 · 참고한 회의록)까지
   * 바퀴마다 끼어든다. 내용이 그대로면 다시 안 읽고, 다음 왕복이 붙으면 비워진다.
   */
  const last = turns[turns.length - 1];
  const said = typing === null && last.mine ? last.a : "";

  return (
    <div
      className={`flex flex-col ${compact ? "h-[488px] px-[13px] pb-3" : "h-[676px] px-4 pb-4"}`}
    >
      {/* 대화 머리 — 서버가 지은 대화 제목과 「새 대화」 · 「기록」. 그림이다. */}
      <div
        className={`flex shrink-0 items-center gap-2 ${compact ? "py-2.5" : "py-3"}`}
      >
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--lp-ink)]">
          결제 화면 개편을 미룬 이유
        </span>
        <Plus aria-hidden className="size-3.5 shrink-0 text-[var(--lp-muted)]" />
        <History
          aria-hidden
          className="ml-1.5 size-3.5 shrink-0 text-[var(--lp-muted)]"
        />
      </div>

      <p role="status" className="sr-only">
        {said}
      </p>
      {/* 흐르는 중에는 답을 `aria-hidden`으로 둔다 — 반쯤 적힌 문장을 그대로 읽히지 않는다.
          알리는 일은 위 `status`가 한다. */}
      <div
        ref={threadRef}
        onScroll={onScroll}
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${compact ? "gap-3.5 pt-1" : "gap-4 pt-1"}`}
      >
        {turns.map((turn, i) => {
          const running = i === typingAt && typing !== null;
          const thinking = running && typing === THINKING;
          return (
            <div
              key={turn.key}
              // 처음부터 떠 있는 왕복(`SEED`)은 안 든다 — 밴드가 뜰 때 이미 서 있다.
              data-turn={i === 0 ? undefined : ""}
              className={`flex shrink-0 flex-col ${compact ? "gap-2" : "gap-2.5"}`}
            >
              <div
                className={`max-w-[85%] self-end rounded-[13px] bg-[var(--lp-rule-soft)] ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}
              >
                {/* 입력창의 칩이 질문과 함께 간다 — 앱은 그 칩을 문장 안 마커로 보내 말풍선
                    앞에 칩으로 다시 그린다(`chat-thread.tsx`의 `ScopeChipMark`). */}
                <span
                  className={`break-keep leading-[1.5] text-[var(--lp-ink)] ${text}`}
                >
                  <NoteChip className="mr-1 align-middle" />
                  <span>{turn.q}</span>
                </span>
              </div>

              {/* 답에는 이름표가 없다 — 앱의 답은 말풍선도 「HeyMoa」 머리도 없이 선다. */}
              <div className="flex flex-col">
                {/* 아직 아무것도 안 내놓은 구간. **스피너를 안 쓴다** — 도는 원은 어디서나
                    도는 원이지만, 빛이 문장 위를 지나가면 그 문장이 지금 살아 있다는
                    뜻이 된다(앱의 `ThinkingLine`이 같은 결이다). */}
                {thinking ? (
                  <p className={`lp-shimmer m-0 ${text}`}>생각하는 중</p>
                ) : (
                  <p
                    aria-hidden={running || undefined}
                    className={`m-0 break-keep leading-[1.7] text-[var(--lp-ink)] ${text}`}
                  >
                    {running ? turn.a.slice(0, typing ?? 0) : turn.a}
                    {/* 스크립트의 받아 적는 줄과 같은 커서다 — 글자만 늘면 「이미 적힌
                        글」과 구분이 안 된다. */}
                    {running ? <span aria-hidden className="lp-caret" /> : null}
                  </p>
                )}
                {/* 근거는 **답이 끝난 뒤에** 선다. 흐르는 중에 그리면 아직 안 읽은 회의록이
                    이미 붙은 것처럼 보인다(`chat-thread.tsx`가 같은 자리를 그렇게 가른다). */}
                {running ? null : <AnswerRefs refs={turn.refs} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* **「예시 질문」이라고 적는다.** 앱의 칩은 빈 대화에만 서는데, 여기 칩은 랜딩이 눌러
          보라고 놓은 것이라서 라벨을 빼면 앱에 있는 기능처럼 읽힌다. */}
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

      {/* 입력창(`chat-composer.tsx`) — 이 회의록 칩이 미리 붙어 있고, 답이 흐르는 동안은
          보내기 자리가 「중지」가 된다. 그림이다. 칩이 붙으면 입력이 빈 것이 아니라서 앱은
          「@로 프로젝트·회의록을 참조해 물어보세요」 안내를 감춘다(`mention-input.tsx` `data-empty`) —
          그래서 칩만 둔다. */}
      <div
        className={`mt-3 flex shrink-0 items-end gap-2 rounded-[9px] border border-[var(--lp-rule-strong)] bg-[var(--lp-card)] ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}
      >
        <span
          className={`flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 leading-[22px] ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}
        >
          <NoteChip />
        </span>
        {typing !== null ? (
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-[var(--lp-rule-strong)] text-[var(--lp-ink)]">
            <Square aria-hidden className="size-3" />
          </span>
        ) : (
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--lp-dark)] text-[var(--lp-on-dark)]">
            <ArrowUp aria-hidden className="size-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 이 회의록 범위 칩. 입력창과 보낸 말풍선이 같이 쓴다 — 앱도 두 자리가 같은 class다
 * (`scope-chip.ts`). 그림이다.
 */
function NoteChip({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-[5px] bg-[color-mix(in_srgb,var(--lp-green)_12%,white)] px-1.5 font-medium text-[var(--lp-green)] ${className}`}
    >
      <FileText aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{TITLE}</span>
    </span>
  );
}

/**
 * 답 아래의 「참고한 회의록 N개」(`chain-of-thought.tsx`의 `AnswerRefs`). 위에 선 하나를 긋고,
 * **1건이면 펴 두고 여럿이면 접어 둔다** — 하나뿐이면 접어도 아낄 자리가 없다. 「출처」가
 * 아니다: 인용한 것이 아니라 본 것이다.
 *
 * 펼치기는 진짜로 된다. 칩은 앱에서 그 노트로 가는 문이지만 여기서는 갈 곳이 없어 그림이다.
 */
function AnswerRefs({ refs }: { refs: string[] }) {
  const [open, setOpen] = useState(refs.length === 1);
  const id = useId();
  return (
    <div
      data-enter
      style={{ "--i": 0 } as React.CSSProperties}
      className="mt-2 border-t border-[var(--lp-rule)] pt-1"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="-ml-1 flex min-h-6 items-center gap-1 rounded-[6px] pr-1.5 text-left"
      >
        <ChevronRight
          aria-hidden
          className={`size-3 shrink-0 text-[var(--lp-muted)] transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="text-[10.5px] text-[var(--lp-muted)]">
          참고한 회의록 {refs.length}개
        </span>
      </button>
      <div id={id} hidden={!open} className="flex flex-wrap gap-1 pt-0.5">
        {refs.map((title) => (
          <span
            key={title}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--lp-rule-strong)] px-1.5 py-px text-[9.5px] text-[var(--lp-body)]"
          >
            <FileText aria-hidden className="size-2.5 shrink-0" />
            <span className="truncate">{title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
