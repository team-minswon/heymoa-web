"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Collapse } from "@/components/heymoa/collapse";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import { SectionBlock } from "@/components/notes/review/section-block";
import { topicsToMarkdown } from "@/lib/notes/review/markdown";
import type { ReviewItem } from "@/lib/notes/review/sections";
import { InlineRetry } from "@/components/ui/inline-retry";
import { CONTEXT_KIND_LABEL } from "@/lib/notes/proposals/presentation";
import type { MeetingLinkIndex, PastNote } from "@/lib/notes/review/meeting-links";
import type { SummarySentence } from "@/lib/notes/review/summary";
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
  onOpenTimeline,
  links,
  workspaceId,
  onRetryLinks,
}: {
  topics: readonly TopicDigest[];
  onOpenTimeline?: () => void;
  /** 이 회의에서 나가는 회의 간 연결. 없으면(조회 전 · 프로젝트 없음) 연결 줄을 그리지 않는다 */
  links?: MeetingLinkIndex;
  workspaceId?: string;
  /** 연결 조회가 실패했다. 연결이 없는 것과 달라 다시 불러올 길을 둔다 */
  onRetryLinks?: () => void;
}) {
  const [openOrdinals, setOpenOrdinals] = useState<ReadonlySet<number>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
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
    <SectionBlock title="주제" count={topics.length} copy={{ build: () => topicsToMarkdown(topics) }}>
      <ul aria-label="주제 목차" className="border-t border-[var(--el-hairline-soft)]">
        {shown.map((topic) => (
          <TopicRow
            key={topic.ordinal}
            topic={topic}
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
            className={cn("size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none", expanded && "rotate-180")}
          />
          {expanded ? `처음 ${VISIBLE_TOPICS}개만` : `나머지 주제 ${topics.length - VISIBLE_TOPICS}개`}
        </button>
      ) : null}
      {onRetryLinks ? (
        <InlineRetry variant="line" label="지난 회의와의 연결을 불러오지 못했습니다." onRetry={onRetryLinks} className="pt-3" />
      ) : null}
    </SectionBlock>
  );
}

const COUNT_NAME: Record<Tone, string> = { decision: "결정", task: "할 일", open: "열린 질문" };

/**
 * 「〈회의 이름〉에서 이어짐」. 회의 이름이 그 회의 요약으로 가는 링크다. 이어짐만 말하고 무엇이 바뀌었다고
 * 단정하지 않는다 — 연결은 사람 검토 없이 만들어져 틀릴 수 있고, 바꾸는 일은 제안 카드가 맡는다.
 */
function ContinuedFrom({ notes, workspaceId, children }: { notes: readonly PastNote[]; workspaceId?: string; children?: React.ReactNode }) {
  if (notes.length === 0) return null;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] leading-5 text-[var(--el-muted)]">
      {notes.map((note, at) => (
        <span key={note.noteId}>
          {workspaceId ? (
            <Link
              href={`/w/${workspaceId}/notes/${note.noteId}?view=full&tab=summary`}
              className="text-[var(--el-body)] underline decoration-[var(--el-hairline-strong)] underline-offset-[3px] hover:text-[var(--el-ink)] hover:decoration-[var(--el-ink)]"
            >
              {note.title}
            </Link>
          ) : (
            note.title
          )}
          에서 이어짐{at < notes.length - 1 ? " ·" : ""}
        </span>
      ))}
      {children}
    </span>
  );
}

function SentenceList({
  title,
  rows,
  links,
  workspaceId,
}: {
  title: string;
  rows: readonly SummarySentence[];
  links?: MeetingLinkIndex;
  workspaceId?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-medium text-[var(--el-muted)]">{title}</h4>
      <ul className="mt-1 flex list-disc flex-col gap-1.5 pl-4 text-sm leading-[22px] break-keep text-[var(--el-ink)]">
        {rows.map((row, at) => {
          const past = row.itemIds.flatMap((id) => links?.byItemId.get(id) ?? []);
          return (
            <li key={`${at}-${row.text}`}>
              {row.text}
              {past.length > 0 ? (
                <span className="mt-0.5 flex flex-col">
                  {past.map((item) => (
                    <ContinuedFrom key={`${item.noteId}-${item.content}`} notes={[item]} workspaceId={workspaceId}>
                      <span className="text-[var(--el-muted-soft)]">
                        {CONTEXT_KIND_LABEL[item.kind]} 「{item.content}」
                      </span>
                    </ContinuedFrom>
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TopicRow({
  topic,
  open,
  onToggle,
  onOpenTimeline,
  links,
  workspaceId,
}: {
  topic: TopicDigest;
  open: boolean;
  onToggle: () => void;
  onOpenTimeline?: () => void;
  links?: MeetingLinkIndex;
  workspaceId?: string;
}) {
  const continued = topic.agendaId ? (links?.byAgendaId.get(topic.agendaId) ?? []) : [];
  // 새 요약은 설명 · 결론 · 남은 일을 나눠 준다. 셋 다 없는 옛 요약은 서술과 항목 목록으로 그린다.
  const structured = topic.description.length + topic.conclusions.length + topic.openItems.length > 0;
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
    <li className="border-b border-[var(--el-hairline-soft)]">
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
          <span className="text-[15px] leading-6 font-medium break-keep text-[var(--el-ink)]">{topic.title}</span>
          {topic.gist && !open ? (
            <span className="truncate text-[13.5px] leading-5 text-[var(--el-muted)]">{topic.gist}</span>
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
          <ContinuedFrom notes={continued} workspaceId={workspaceId} />
        </div>
      ) : null}
      <Collapse open={open} lazy>
        <div className="flex flex-col gap-3 pb-[18px] pl-0 sm:pr-7 sm:pl-[68px]">
          {structured ? (
            <>
              {topic.description.length > 0 ? (
                <p className="text-[14.5px] leading-[26px] break-keep text-[var(--el-body)]">
                  {topic.description.map((row) => row.text).join(" ")}
                </p>
              ) : null}
              <SentenceList title="결론" rows={topic.conclusions} links={links} workspaceId={workspaceId} />
              <SentenceList title="남은 일" rows={topic.openItems} links={links} workspaceId={workspaceId} />
            </>
          ) : topic.text ? (
            <p className="text-[14.5px] leading-[26px] break-keep text-[var(--el-body)]">{topic.text}</p>
          ) : null}
          {!structured && lines.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {lines.map(([tone, item]) => (
                <li
                  key={item.itemId}
                  className={cn(
                    "grid grid-cols-[16px_minmax(0,1fr)] items-start gap-x-2 text-sm leading-[22px] break-keep",
                    tone === "open" ? "text-[var(--el-body)]" : "text-[var(--el-ink)]"
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
