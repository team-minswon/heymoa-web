"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Collapse } from "@/components/heymoa/collapse";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import { SectionBlock } from "@/components/notes/review/section-block";
import type { ReviewItem } from "@/lib/notes/review/sections";
import type {
  MeetingLinkIndex,
  PastNote,
} from "@/lib/notes/review/meeting-links";
import type { TopicDigest } from "@/lib/notes/review/topics";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

const VISIBLE_TOPICS = 6;

type Tone = "decision" | "task" | "open";

/**
 * 주제 개요(APP-865). 회의에서 나온 차례로 한 줄씩 서고 — 때 · 제목 · 한 줄 서술 · 결정 / 할 일 /
 * 열린 질문 개수 — 누르면 그 자리에서 펼쳐져 서술 전체와 그 주제의 항목이 선다. 앞의 여섯만 서고
 * 나머지는 접힌다.
 */
export function TopicIndex({
  topics,
  noteId,
  onOpenTimeline,
  links,
  workspaceId,
}: {
  topics: readonly TopicDigest[];
  noteId?: string;
  onOpenTimeline?: () => void;
  /** 이 회의에서 나가는 회의 간 연결. 없으면(조회 전 · 프로젝트 없음) 연결 줄을 그리지 않는다 */
  links?: MeetingLinkIndex;
  workspaceId?: string;
}) {
  const [openOrdinals, setOpenOrdinals] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  const [expanded, setExpanded] = useState(false);
  const followedHash = useRef<string | null>(null);
  const selectAgenda = useCallback(
    (agendaId: string) => {
      const target = topics.find((topic) => topic.agendaId === agendaId);
      if (!target) return;
      setExpanded(true);
      setOpenOrdinals((current) =>
        current.has(target.ordinal)
          ? current
          : new Set([...current, target.ordinal])
      );
      window.setTimeout(() => {
        const element = document.getElementById(`summary-agenda-${agendaId}`);
        element?.querySelector("button")?.focus({ preventScroll: true });
        element?.scrollIntoView?.({ block: "center" });
      }, 240);
    },
    [topics]
  );
  useEffect(() => {
    const followHash = () => {
      const prefix = "#summary-agenda-";
      const hash = window.location.hash;
      if (!hash.startsWith(prefix)) {
        followedHash.current = null;
        return;
      }
      const key = `${noteId ?? ""}:${hash}`;
      if (followedHash.current === key) return;
      const agendaId = hash.slice(prefix.length);
      if (!topics.some((topic) => topic.agendaId === agendaId)) return;
      followedHash.current = key;
      selectAgenda(agendaId);
    };
    const timer = window.setTimeout(followHash, 0);
    window.addEventListener("hashchange", followHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", followHash);
    };
  }, [selectAgenda, noteId, topics]);
  if (topics.length === 0) return null;
  const shown = expanded ? topics : topics.slice(0, VISIBLE_TOPICS);
  const toggle = (ordinal: number) =>
    setOpenOrdinals((current) => {
      const next = new Set(current);
      if (next.has(ordinal)) next.delete(ordinal);
      else next.add(ordinal);
      return next;
    });

  return (
    <SectionBlock title="주제" count={topics.length}>
      <ul
        aria-label="주제 목차"
        className="border-t border-[var(--el-hairline-soft)]"
      >
        {shown.map((topic) => (
          <TopicRow
            key={topic.ordinal}
            topic={topic}
            noteId={noteId}
            onSelectAgenda={selectAgenda}
            open={openOrdinals.has(topic.ordinal)}
            onToggle={() => toggle(topic.ordinal)}
            onOpenTimeline={onOpenTimeline}
            links={links}
            workspaceId={workspaceId}
          />
        ))}
      </ul>
      {topics.length > VISIBLE_TOPICS ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="-ml-2 mt-2 inline-flex h-[30px] items-center gap-1.5 rounded-control px-2 text-[13px] text-[var(--el-body)] hover:bg-[var(--el-canvas-soft)]"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none",
              expanded && "rotate-180"
            )}
          />
          {expanded
            ? `처음 ${VISIBLE_TOPICS}개만`
            : `나머지 주제 ${topics.length - VISIBLE_TOPICS}개`}
        </button>
      ) : null}
    </SectionBlock>
  );
}

const COUNT_NAME: Record<Tone, string> = {
  decision: "결정",
  task: "할 일",
  open: "열린 질문",
};

/**
 * 「〈회의 이름〉에서 이어짐」. 회의 이름이 그 회의 요약으로 가는 링크다. 이어짐만 말하고 무엇이 바뀌었다고
 * 단정하지 않는다 — 연결은 사람 검토 없이 만들어져 틀릴 수 있고, 바꾸는 일은 제안 카드가 맡는다.
 */
function ContinuedFrom({
  notes,
  workspaceId,
  noteId,
  onSelectAgenda,
}: {
  notes: readonly PastNote[];
  workspaceId?: string;
  noteId?: string;
  onSelectAgenda: (agendaId: string) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] leading-5 text-[var(--el-muted)]">
      {notes.map((note) => (
        <span
          key={`${note.noteId}:${note.agendaId}`}
          className="inline-flex items-baseline gap-1"
        >
          <span
            aria-hidden
            className="border-l border-b border-[var(--el-hairline-strong)] w-3 h-2"
          />
          {note.noteId === noteId ? (
            <a
              href={`#summary-agenda-${note.agendaId}`}
              onClick={(event) => {
                event.preventDefault();
                onSelectAgenda(note.agendaId);
              }}
              className="text-[var(--el-body)] underline underline-offset-[3px]"
            >
              {note.agendaTitle}
            </a>
          ) : workspaceId ? (
            <Link
              href={`/w/${workspaceId}/notes/${note.noteId}?view=full&tab=summary#summary-agenda-${note.agendaId}`}
              className="text-[var(--el-body)] underline decoration-[var(--el-hairline-strong)] underline-offset-[3px] hover:text-[var(--el-ink)]"
            >
              {note.title}
            </Link>
          ) : (
            note.title
          )}
          에서 이어짐
        </span>
      ))}
    </span>
  );
}

function TopicRow({
  topic,
  noteId,
  onSelectAgenda,
  open,
  onToggle,
  onOpenTimeline,
  links,
  workspaceId,
}: {
  topic: TopicDigest;
  noteId?: string;
  onSelectAgenda: (agendaId: string) => void;
  open: boolean;
  onToggle: () => void;
  onOpenTimeline?: () => void;
  links?: MeetingLinkIndex;
  workspaceId?: string;
}) {
  const continued = topic.agendaId
    ? (links?.byAgendaId.get(topic.agendaId) ?? [])
    : [];

  const counts = (
    [
      ["decision", topic.decisions.length],
      ["task", topic.tasks.length],
      ["open", topic.open.length],
    ] as const
  ).filter(([, count]) => count > 0);
  const lines: Array<[Tone, ReviewItem]> = [
    ...topic.decisions.map((item) => ["decision", item] as [Tone, ReviewItem]),
    ...topic.tasks.map((item) => ["task", item] as [Tone, ReviewItem]),
    ...topic.open.map((item) => ["open", item] as [Tone, ReviewItem]),
  ];
  const span =
    topic.startMs === null
      ? null
      : topic.endMs !== null && topic.endMs - topic.startMs >= 1_000
        ? `${formatOffset(topic.startMs)}–${formatOffset(topic.endMs)}`
        : formatOffset(topic.startMs);

  return (
    <li
      id={topic.agendaId ? `summary-agenda-${topic.agendaId}` : undefined}
      className="scroll-mt-24 border-b border-[var(--el-hairline-soft)]"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="-mx-2 grid w-[calc(100%+16px)] grid-cols-[44px_minmax(0,1fr)_16px] items-start gap-x-3 rounded-control px-2 py-3 text-left hover:bg-[var(--el-canvas-soft)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--el-ink)] sm:grid-cols-[56px_minmax(0,1fr)_auto_16px]"
      >
        <span className="text-xs leading-6 tabular-nums text-[var(--el-muted-soft)]">
          {topic.startMs === null ? "" : formatOffset(topic.startMs)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] leading-6 font-medium text-[var(--el-ink)]">
            {topic.title}
          </span>
          {topic.gist && !open ? (
            <span className="whitespace-pre-wrap text-[13.5px] leading-6 break-words text-[var(--el-muted)]">
              {topic.gist}
            </span>
          ) : null}
        </span>
        <span className="col-start-2 row-start-2 mt-1 flex h-6 items-center gap-2.5 text-xs whitespace-nowrap tabular-nums text-[var(--el-muted)] sm:col-start-3 sm:row-start-1 sm:mt-0">
          {counts.map(([tone, count]) => (
            <span key={tone} className="inline-flex items-center gap-1">
              <TimelineToneIcon tone={tone} />
              <span className="sr-only">{COUNT_NAME[tone]} </span>
              {count}
            </span>
          ))}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "col-start-3 row-start-1 mt-1 size-4 text-[var(--el-muted-soft)] transition-transform duration-200 ease-out motion-reduce:transition-none sm:col-start-4",
            open && "rotate-180"
          )}
        />
      </button>
      {continued.length > 0 ? (
        // 버튼 안에 링크를 둘 수 없어 줄 아래에 따로 둔다(주제 제목 칸과 같은 들여쓰기)
        <div className="-mt-2 pb-3 pl-[56px] sm:pl-[68px]">
          <ContinuedFrom
            notes={continued}
            workspaceId={workspaceId}
            noteId={noteId}
            onSelectAgenda={onSelectAgenda}
          />
        </div>
      ) : null}
      <Collapse open={open} lazy>
        <div className="flex flex-col gap-3 pb-[18px] pl-0 sm:pr-7 sm:pl-[68px]">
          {topic.text ? (
            <p className="whitespace-pre-wrap text-[14.5px] leading-[26px] break-words text-[var(--el-body)]">
              {topic.text}
            </p>
          ) : null}
          {lines.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {lines.map(([tone, item]) => (
                <li
                  key={item.itemId}
                  className={cn(
                    "grid grid-cols-[16px_minmax(0,1fr)] items-start gap-x-2 text-sm leading-[22px]",
                    tone === "open"
                      ? "text-[var(--el-body)]"
                      : "text-[var(--el-ink)]"
                  )}
                >
                  <span className="mt-[3px]">
                    <TimelineToneIcon tone={tone} />
                  </span>
                  <span>
                    <span className="sr-only">{COUNT_NAME[tone]} · </span>
                    {item.content}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {onOpenTimeline ? (
            <button
              type="button"
              onClick={onOpenTimeline}
              className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
            >
              타임라인에서 보기{span ? ` · ${span}` : ""}
              <ArrowUpRight aria-hidden className="size-3" />
            </button>
          ) : null}
        </div>
      </Collapse>
    </li>
  );
}
