"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Folder,
  Users,
} from "lucide-react";

import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import { useLivePartial } from "@/components/notes/use-live-partial";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import { InlineRetry } from "@/components/ui/inline-retry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProposalHead } from "@/lib/notes/proposals/contract";
import {
  CONTEXT_KIND_LABEL,
  CONTEXT_OPERATION_LABEL,
} from "@/lib/notes/proposals/presentation";
import {
  selectTimeline,
  TIMELINE_FILTERS,
  type TimelineFilter,
  type TimelineGroup,
  type TimelineItem,
  type TimelineTone,
} from "@/lib/notes/proposals/timeline";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

/**
 * 본문 「타임라인」 탭 — 실시간 정리 원장을 회의가 흘러간 순서로 읽는 면이다.
 *
 * **이 화면은 실시간 요약이 아니다.** 끝난 발화에서 남길 만한 변화만 항목이 되고, 대부분의
 * 분석 배치는 항목을 0건 낸다. 그래서 받아 적는 중인 줄에 「정리해 붙인다」고 약속하지 않는다 —
 * 그 말 대부분은 항목이 되지 않는다.
 *
 * **유형은 모양과 요약 화면의 역할 색으로 말한다.** 결정은 채운 체크, 할 일은 빈 원, 열린
 * 질문은 점선 원, 답한 질문은 회색 체크, 참고는 작은 점이다. 색만으로 말하지 않는다 — 옆에
 * 늘 유형 이름이 선다(`role-dot.tsx` 와 같은 약속).
 *
 * **움직임이 없다.** 항목이 붙고 펼쳐지는 것을 애니메이션하지 않는다 — 회의 중에 계속 붙는
 * 목록이라 움직이면 읽던 줄이 흔들린다.
 */

export type TimelineHeader = {
  title: string;
  whenIso: string;
  whenLabel: string;
  participantCount: number;
  projectName: string | null;
};

/** 유형 이름의 색. 역할 색을 글자로 쓰면 흰 바탕에서 옅어서 한 단 진하게 둔다. */
const TONE_TEXT: Record<TimelineTone, string> = {
  decision: "text-[#1d5fa8]",
  task: "text-[#13805a]",
  open: "text-[#b4501f]",
  answered: "text-[var(--el-muted)]",
  reference: "text-[var(--el-muted)]",
};

const TONE_TITLE: Record<TimelineTone, string> = {
  decision: "font-medium text-[var(--el-ink)]",
  task: "font-medium text-[var(--el-ink)]",
  open: "text-[var(--el-ink)]",
  answered: "text-[var(--el-muted)]",
  reference: "text-[var(--el-body)]",
};

/** 마지막 갱신을 사람 말로. 서버 시각과 지금의 차이다. */
export function formatFreshness(lastBatchAt: string | null, now: number) {
  if (!lastBatchAt) return null;
  const elapsed = now - Date.parse(lastBatchAt);
  if (!Number.isFinite(elapsed)) return null;
  if (elapsed < 45_000) return "방금";
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 전`;
}

/**
 * 흐르는 시계. **렌더 중에 `Date.now()` 를 부르지 않는다** — hydration 이 어긋나고, 항목이 안
 * 오면 몇 분씩 리렌더가 없어 「방금」이 30분째 남는다. 서버에서는 `null` 이다.
 */
function useNow(intervalMs: number) {
  const [now, setNow] = useState<number | null>(() =>
    typeof window === "undefined" ? null : Date.now()
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const NONE: ReadonlySet<string> = new Set();

/** 끝에서 이만큼 안이면 끝을 읽고 있는 것으로 본다. 스크립트 탭과 같은 값이다. */
const FOLLOW_THRESHOLD_PX = 180;

const itemId = (proposalId: string) => `timeline-item-${proposalId}`;

function metaOf(item: TimelineItem): Array<{ text: string; tone?: "error" }> {
  const { proposal } = item;
  const parts: Array<{ text: string; tone?: "error" }> = [];
  if (proposal.closeReason === "RETRACTED") {
    parts.push({ text: "철회됨", tone: "error" });
  } else if (proposal.operation === "AMEND" || proposal.operation === "CORRECT") {
    parts.push({ text: CONTEXT_OPERATION_LABEL[proposal.operation] });
  }
  if (item.tone === "open" && proposal.kind === "QUESTION") {
    parts.push({ text: "답을 기다리는 중" });
  }
  if (item.tone === "answered") {
    const at = item.answers[0]?.citations[0]?.startedAtMs;
    parts.push({ text: at === undefined ? "답함" : `${formatOffset(at)}에 답함` });
  }
  return parts;
}

function groupRange(group: TimelineGroup, recording: boolean) {
  if (group.startMs === null) return null;
  const start = formatOffset(group.startMs);
  if (group.endMs !== null) return `${start} – ${formatOffset(group.endMs)}`;
  if (group.last && recording) return `${start} – 지금`;
  return start;
}

export function NoteTimeline({
  header,
  onEvidenceSelect,
  meetingEnded = false,
  recording = false,
}: {
  /** 문서 머리(제목·시각·참여 인원·프로젝트). 노트를 아직 못 읽었으면 비운다. */
  header: TimelineHeader | null;
  /** 근거를 누르면 스크립트의 그 발화로 간다. 소유자는 `NotePanel` 이다. */
  onEvidenceSelect: (segmentId: string) => void;
  /** 종료된 회의는 더 안 쌓인다 — 진행형 문구가 미래를 약속하면 거짓이 된다. */
  meetingEnded?: boolean;
  /**
   * 회의가 기록 중이다. 「논의 중」과 「– 지금」은 이때만 말한다 — 시작 전이나 중지된 회의의
   * 마지막 안건을 지금 논의 중이라고 하면 거짓이다.
   */
  recording?: boolean;
}) {
  const { context, noteId } = useNoteRealtime();
  const partial = useLivePartial(noteId);

  // **화면 상태에 주어(noteId)를 담는다.** 이 면은 노트가 바뀌어도 재마운트되지 않아서, 값만
  // 담으면 A에서 고른 유형·펼친 항목이 B에 남는다.
  const [view, setView] = useState<{
    noteId: string;
    filter: TimelineFilter;
    open: ReadonlySet<string>;
    folded: ReadonlySet<string>;
  }>({ noteId, filter: "ALL", open: NONE, folded: NONE });
  if (view.noteId !== noteId) {
    setView({ noteId, filter: "ALL", open: NONE, folded: NONE });
  }
  const filter = view.filter;
  // 칩은 바로 바뀌고 목록은 뒤따른다 — 수백 줄을 다시 그리는 동안 누른 칩이 멈춰 보이지 않게.
  const listFilter = useDeferredValue(filter);
  const toggle = (key: "open" | "folded", id: string) =>
    setView((current) => {
      const next = new Set(current[key]);
      if (!next.delete(id)) next.add(id);
      return { ...current, [key]: next };
    });

  const timeline = useMemo(
    () => selectTimeline(context.state, listFilter),
    [context.state, listFilter]
  );

  /** 관계(질문 ↔ 답)를 누르면 그 항목을 펼치고 화면 가운데로 데려온다. */
  const pendingScroll = useRef<string | null>(null);
  const jumpTo = (proposal: ProposalHead) => {
    pendingScroll.current = proposal.proposalId;
    setView((current) => ({
      ...current,
      filter: "ALL",
      open: new Set(current.open).add(proposal.proposalId),
      folded: NONE,
    }));
  };
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    // 골라 보기를 「전체」로 되돌린 목록은 `useDeferredValue` 로 한 박자 늦게 선다 — 그 사이
    // 커밋에는 대상이 아직 없다. 찾을 때까지 비우지 않고 다음 커밋에서 다시 본다.
    const element = document.getElementById(itemId(target));
    if (!element) return;
    pendingScroll.current = null;
    element.scrollIntoView?.({ block: "center" });
  });

  /**
   * **끝을 읽고 있으면 새 항목을 따라간다.** 기록 중에는 항목과 받아 적는 줄이 아래에 붙는데,
   * 스크롤 위치가 그대로면 새 줄이 화면 밖으로 밀린다. 위를 읽는 사람은 그대로 둔다.
   *
   * 따라갈지는 **새 줄이 붙기 전에** 정한다(rule `architecture`) — 스크롤할 때마다 끝과의
   * 거리를 재 두고, 내용이 바뀐 커밋에서는 그 값만 본다. 붙은 뒤에 재면 이미 밀린 거리를 잰다.
   */
  const viewportRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleScroll = () => {
      followingRef.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
        FOLLOW_THRESHOLD_PX;
    };
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => {
    if (!recording || !followingRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [recording, context.state, partial?.confirmedText, partial?.pendingText]);

  // **첫 snapshot 이 서기 전에는 개수를 말하지 않는다.** 조회 중·실패의 0은 잰 값이 아니다.
  const settled = !context.loading && !context.failed;
  const now = useNow(20_000);
  const freshness =
    now === null ? null : formatFreshness(context.state.lastBatchAt, now);
  const hint = meetingEnded
    ? "이 회의에서 남길 만한 변화만 기록했습니다"
    : freshness
      ? `말이 끝날 때마다 정리됩니다 · ${freshness} 갱신`
      : "말이 끝날 때마다 정리됩니다";

  return (
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      viewportClassName="overflow-x-hidden!"
    >
      <div className="mx-auto w-full max-w-[calc(760px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-10 pb-36">
        {header ? (
          <header>
            <h2 className="font-serif text-[28px] font-medium leading-[38px] tracking-[-0.4px] text-[var(--el-ink)]">
              {header.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <HeaderChip icon={Calendar}>
                <time dateTime={header.whenIso}>{header.whenLabel}</time>
              </HeaderChip>
              {header.participantCount > 0 ? (
                <HeaderChip icon={Users}>{`${header.participantCount}명`}</HeaderChip>
              ) : null}
              {header.projectName ? (
                <HeaderChip icon={Folder}>{header.projectName}</HeaderChip>
              ) : null}
            </div>
          </header>
        ) : null}

        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--el-hairline-soft)] pb-2.5",
            header ? "mt-8" : null
          )}
        >
          <div role="group" aria-label="유형으로 골라 보기" className="flex flex-wrap items-center gap-0.5">
            {TIMELINE_FILTERS.map((option) => {
              const active = option.value === filter;
              const count = timeline.counts[option.value];
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  aria-label={settled ? `${option.label} ${count}` : option.label}
                  onClick={() =>
                    setView((current) => ({ ...current, filter: option.value }))
                  }
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-[7px] px-[9px] text-[13px] transition-colors",
                    active
                      ? "bg-[var(--el-surface-strong)] font-medium text-[var(--el-ink)]"
                      : "text-[var(--el-muted)] hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)]"
                  )}
                >
                  {option.label}
                  <span className="text-[12px] font-normal tabular-nums text-[var(--el-muted-soft)]">
                    {settled ? count : "–"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-[var(--el-muted-soft)]">{hint}</p>
        </div>

        {/* **놓친 변경이 있다.** 순서가 빈 revision 을 받으면 provider 가 원장을 다시 받는다 —
            그게 끝나기 전, 특히 다시 받기가 실패해 갇혔을 때 목록은 낡았을 수 있다. 목록은
            그대로 두고 그 사실과 다시 맞출 길을 남긴다. */}
        {settled && context.state.needsRefetch ? (
          <div
            role="status"
            className="mt-4 flex items-center justify-between gap-3 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-3.5 py-2.5 text-[13px] text-[var(--el-body)]"
          >
            <span>놓친 변경이 있어 타임라인을 다시 맞추는 중입니다.</span>
            <button
              type="button"
              onClick={context.retry}
              className="shrink-0 text-[13px] font-medium text-[var(--el-ink)] underline decoration-[var(--el-hairline-strong)] underline-offset-[3px]"
            >
              다시 맞추기
            </button>
          </div>
        ) : null}

        {context.loading ? (
          <ul aria-label="타임라인을 불러오는 중" className="mt-7 flex flex-col">
            {[0, 1, 2].map((row) => (
              <li
                key={row}
                className="grid grid-cols-[44px_40px_minmax(0,1fr)] py-[7px]"
              >
                <Skeleton className="mt-1.5 ml-auto h-3 w-9" />
                <span />
                <span className="flex flex-col gap-1.5">
                  <Skeleton className="h-[18px] w-[70%]" />
                  <Skeleton className="h-3.5 w-24" />
                </span>
              </li>
            ))}
          </ul>
        ) : context.failed ? (
          <InlineRetry
            className="mt-7"
            label="타임라인을 불러오지 못했습니다."
            onRetry={context.retry}
          />
        ) : timeline.groups.length === 0 ? (
          // **오류가 아니다.** 정리할 끝난 발화가 없다는 사실은 정상 경로다.
          <p className="mt-7 text-[14px] leading-relaxed text-[var(--el-muted)]">
            {timeline.counts.ALL === 0
              ? meetingEnded
                ? "이 회의에서 정리된 항목이 없습니다."
                : "아직 정리할 발화가 없습니다. 결정·할 일·질문이 나오면 여기에 쌓입니다."
              : "이 유형으로 정리된 항목이 없습니다."}
          </p>
        ) : (
          timeline.groups.map((group) => {
            const key = group.agenda?.proposalId ?? "lead";
            const folded = view.folded.has(key);
            const listId = `timeline-group-${key}`;
            return (
              <section key={key} className="mt-7">
                {group.agenda ? (
                  <h3 className="-mx-2 flex h-[30px] w-[calc(100%+16px)] items-center gap-0.5">
                    {/* **안건도 근거로 갈 수 있어야 한다.** 머리는 접는 손잡이라, 안건의 첫 발화로
                        가는 길은 시간 구간이 진다 — 항목의 시각 열과 같은 약속이다. */}
                    {group.agenda.citations[0] ? (
                      <button
                        type="button"
                        aria-label={`스크립트 ${formatOffset(group.agenda.citations[0].startedAtMs)}로 가기`}
                        onClick={() =>
                          onEvidenceSelect(group.agenda!.citations[0].segmentId)
                        }
                        className="h-full shrink-0 rounded-[7px] px-2 text-[12px] tabular-nums text-[var(--el-muted-soft)] transition-colors hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)]"
                      >
                        {groupRange(group, recording)}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-expanded={!folded}
                      aria-controls={listId}
                      onClick={() => toggle("folded", key)}
                      className={cn(
                        "flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-[7px] pr-2 text-left transition-colors hover:bg-[var(--el-canvas-soft)]",
                        group.agenda.citations[0] ? "pl-1" : "pl-2"
                      )}
                    >
                      <span
                        className={cn(
                          "min-w-0 truncate text-[15px] font-semibold text-[var(--el-ink)]",
                          group.agenda.closeReason === "RETRACTED" &&
                            "text-[var(--el-muted-soft)] line-through"
                        )}
                      >
                        {group.agenda.content}
                      </span>
                      {group.agenda.closeReason === "RETRACTED" ? (
                        <span className="shrink-0 text-[12px] font-medium text-[var(--el-error-strong)]">
                          철회됨
                        </span>
                      ) : null}
                      <span className="-ml-1 shrink-0 text-[12.5px] tabular-nums text-[var(--el-muted-soft)]">
                        {group.total}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className={cn(
                          "-ml-1.5 size-3.5 shrink-0 text-[var(--el-muted-soft)]",
                          !folded && "rotate-90"
                        )}
                      />
                      <span className="flex-1" />
                      {group.last && recording ? (
                        <span className="inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-[6px] bg-[var(--el-success)]/10 px-2 text-[12px] text-[var(--el-success-strong)]">
                          <span className="size-1.5 rounded-full bg-[var(--el-success)]" />
                          논의 중
                        </span>
                      ) : null}
                    </button>
                  </h3>
                ) : null}
                {folded ? null : (
                  <ol id={listId} className="relative mt-1.5">
                    <span
                      aria-hidden
                      className="absolute top-4 bottom-4 left-[63px] w-px bg-[var(--el-hairline)]"
                    />
                    {group.items.map((item) => (
                      <TimelineRow
                        key={item.proposal.proposalId}
                        item={item}
                        open={view.open.has(item.proposal.proposalId)}
                        onToggle={() => toggle("open", item.proposal.proposalId)}
                        onEvidenceSelect={onEvidenceSelect}
                        onJump={jumpTo}
                      />
                    ))}
                  </ol>
                )}
              </section>
            );
          })
        )}

        {/* 받아 적는 중인 발화. 확정 앞부분은 진하게, 다음 조각이 갈아치울 뒷부분은 옅게 —
            스크립트 탭의 같은 줄과 같은 규칙이다. 화자 칸은 없다(분리는 회의 뒤에 끝난다). */}
        {partial ? (
          <div
            aria-live="polite"
            aria-atomic="true"
            className="mt-[18px] grid grid-cols-[44px_40px_minmax(0,1fr)] border-t border-dashed border-[var(--el-hairline)] pt-4"
          >
            <span />
            <span className="flex justify-center pt-[9px]">
              <span className="size-1.5 rounded-full bg-red-500" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="break-keep text-[15px] leading-6 text-[var(--el-muted-soft)]">
                {partial.confirmedText ? (
                  <span className="text-[var(--el-muted)]">{partial.confirmedText}</span>
                ) : null}
                {partial.pendingText}
              </span>
              <span className="text-[12.5px] leading-[19px] text-[var(--el-muted)]">
                받아 적는 중
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}

function HeaderChip({
  icon: Icon,
  children,
}: {
  icon: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-[8px] border border-[var(--el-hairline)] px-[9px] text-[12.5px] text-[var(--el-body)]">
      <Icon aria-hidden className="size-[13px] text-[var(--el-muted)]" />
      {children}
    </span>
  );
}

function TimelineRow({
  item,
  open,
  onToggle,
  onEvidenceSelect,
  onJump,
}: {
  item: TimelineItem;
  open: boolean;
  onToggle: () => void;
  onEvidenceSelect: (segmentId: string) => void;
  onJump: (proposal: ProposalHead) => void;
}) {
  const { proposal, tone } = item;
  const retracted = proposal.closeReason === "RETRACTED";
  const first = proposal.citations[0];
  const relations = [
    ...item.answers.map((answer) => ({ lead: "답", proposal: answer })),
    ...(item.answersTo ? [{ lead: "답한 질문", proposal: item.answersTo }] : []),
  ];
  const expandable = proposal.citations.length > 0 || relations.length > 0;
  const detailsId = `${itemId(proposal.proposalId)}-details`;
  const meta = metaOf(item);

  return (
    <li id={itemId(proposal.proposalId)} className="relative">
      <article className="grid grid-cols-[44px_40px_minmax(0,1fr)] py-[7px]">
        {/* **`segmentId` 로만 찾는다** — `startedAtMs` 는 세션별 오프셋이라 세션이 둘 이상이면
            화면의 시각과 어긋난다(APP-398 선례). */}
        {first ? (
          <button
            type="button"
            aria-label={`스크립트 ${formatOffset(first.startedAtMs)}로 가기`}
            onClick={() => onEvidenceSelect(first.segmentId)}
            className="self-start text-right text-[12px] leading-6 tabular-nums text-[var(--el-muted-soft)] transition-colors hover:text-[var(--el-ink)]"
          >
            {formatOffset(first.startedAtMs)}
          </button>
        ) : (
          <span />
        )}
        <span className="flex justify-center pt-1">
          <span className="inline-flex rounded-full bg-white">
            <TimelineToneIcon tone={tone} retracted={retracted} />
          </span>
        </span>
        <div className="min-w-0">
          <button
            type="button"
            disabled={!expandable}
            aria-expanded={expandable ? open : undefined}
            aria-controls={expandable ? detailsId : undefined}
            onClick={onToggle}
            className={cn(
              "group/row -ml-2 grid w-[calc(100%+8px)] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 rounded-[7px] px-2 text-left transition-colors",
              expandable ? "hover:bg-[var(--el-canvas-soft)]" : "cursor-default"
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "break-keep text-[15px] leading-6",
                  retracted
                    ? "text-[var(--el-muted-soft)] line-through decoration-[var(--el-muted-soft)]"
                    : TONE_TITLE[tone]
                )}
              >
                {proposal.content}
              </span>
              <span className="text-[12.5px] leading-[19px] text-[var(--el-muted)]">
                <span className={TONE_TEXT[tone]}>
                  {CONTEXT_KIND_LABEL[proposal.kind]}
                </span>
                {meta.map((part) => (
                  <span key={part.text}>
                    <span aria-hidden className="mx-1.5 text-[var(--el-hairline-strong)]">
                      ·
                    </span>
                    <span
                      className={
                        part.tone === "error"
                          ? "font-medium text-[var(--el-error-strong)]"
                          : undefined
                      }
                    >
                      {part.text}
                    </span>
                  </span>
                ))}
              </span>
            </span>
            {expandable ? (
              <ChevronDown
                aria-hidden
                className={cn(
                  "mt-1 size-4 text-[var(--el-hairline-strong)] group-hover/row:text-[var(--el-muted)]",
                  open && "rotate-180"
                )}
              />
            ) : null}
          </button>

          {open && expandable ? (
            <div
              id={detailsId}
              className="mt-2.5 overflow-hidden rounded-[10px] border border-[var(--el-hairline)]"
            >
              {proposal.citations.length > 0 ? (
                <ul className="flex flex-col gap-0.5 px-2 py-2">
                  {proposal.citations.map((citation) => (
                    <li key={`${citation.segmentId}-${citation.role}`}>
                      <button
                        type="button"
                        onClick={() => onEvidenceSelect(citation.segmentId)}
                        className="grid w-full grid-cols-[40px_minmax(0,1fr)] gap-x-2.5 rounded-[7px] px-1.5 py-1 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
                      >
                        <time className="text-[12px] leading-[22px] tabular-nums text-[var(--el-muted-soft)]">
                          {formatOffset(citation.startedAtMs)}
                        </time>
                        <span className="break-keep text-[14px] leading-[22px] text-[var(--el-body-strong)]">
                          {citation.text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {relations.map((relation) => {
                const at = relation.proposal.citations[0]?.startedAtMs;
                return (
                  <button
                    key={`${relation.lead}-${relation.proposal.proposalId}`}
                    type="button"
                    onClick={() => onJump(relation.proposal)}
                    className={cn(
                      "flex w-full items-center gap-2 bg-[var(--el-canvas-soft)] px-3.5 py-[9px] text-left text-[13px] leading-5 text-[var(--el-muted)] transition-colors hover:text-[var(--el-ink)]",
                      proposal.citations.length > 0 &&
                        "border-t border-[var(--el-hairline-soft)]"
                    )}
                  >
                    <ArrowUpRight aria-hidden className="size-[13px] shrink-0" />
                    <span className="shrink-0">{relation.lead}</span>
                    <span className="min-w-0 truncate text-[var(--el-ink)]">
                      {relation.proposal.content}
                    </span>
                    <span className="flex-1" />
                    {at !== undefined ? (
                      <span className="shrink-0 tabular-nums text-[var(--el-muted-soft)]">
                        {formatOffset(at)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  );
}
