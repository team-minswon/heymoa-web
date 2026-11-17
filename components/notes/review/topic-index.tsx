"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Collapse } from "@/components/heymoa/collapse";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import {
  evidenceMarkOf,
  SCREEN_CHANGE_HOLD_MS,
} from "@/components/notes/use-transcript-focus";
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

export function TopicIndex({
  topics,
  noteId,
  onOpenTimeline,
  links,
  workspaceId,
  projectId,
}: {
  topics: readonly TopicDigest[];
  noteId?: string;
  onOpenTimeline?: (agendaId: string | null) => void;
  links?: MeetingLinkIndex;
  workspaceId?: string;
  projectId?: string;
}) {
  const t = useTranslations("notes.review.topics");
  const [openOrdinals, setOpenOrdinals] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  const [expanded, setExpanded] = useState(false);
  const followedHash = useRef<string | null>(null);
  const [marked, setMarked] = useState<{
    agendaId: string;
    nonce: number;
    holdMs?: number;
  } | null>(null);
  const selectAgenda = useCallback(
    (agendaId: string, holdMs?: number) => {
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
        setMarked((current) => ({
          agendaId,
          nonce: (current?.nonce ?? 0) + 1,
          holdMs,
        }));
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
      selectAgenda(agendaId, SCREEN_CHANGE_HOLD_MS);
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, [selectAgenda, noteId, topics]);
  const markedTitle = topics.find(
    (topic) => topic.agendaId === marked?.agendaId
  )?.title;
  useEffect(() => {
    if (markedTitle === undefined) return;
    const timer = window.setTimeout(
      () => setMarked(null),
      evidenceMarkOf(markedTitle, { holdMs: marked?.holdMs }).lifetimeMs
    );
    return () => window.clearTimeout(timer);
  }, [marked, markedTitle]);
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
    <SectionBlock title={t("title")} count={topics.length}>
      <ul
        aria-label={t("label")}
        className="border-t border-[var(--el-hairline-soft)]"
      >
        {shown.map((topic) => (
          <TopicRow
            key={topic.ordinal}
            topic={topic}
            noteId={noteId}
            onSelectAgenda={selectAgenda}
            mark={
              topic.agendaId && topic.agendaId === marked?.agendaId
                ? marked
                : null
            }
            open={openOrdinals.has(topic.ordinal)}
            onToggle={() => toggle(topic.ordinal)}
            onOpenTimeline={onOpenTimeline}
            links={links}
            workspaceId={workspaceId}
            projectId={projectId}
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
            ? t("showFirst", { count: VISIBLE_TOPICS })
            : t("showRest", { count: topics.length - VISIBLE_TOPICS })}
        </button>
      ) : null}
    </SectionBlock>
  );
}

function ContinuedFrom({
  notes,
  workspaceId,
  noteId,
  onSelectAgenda,
  mapHref,
}: {
  notes: readonly PastNote[];
  workspaceId?: string;
  noteId?: string;
  onSelectAgenda: (agendaId: string) => void;
  mapHref?: string;
}) {
  const t = useTranslations("notes.review.topics");
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
          <span>
            {note.noteId === noteId
              ? t.rich("continuedFrom", {
                  title: note.agendaTitle ?? t("agenda"),
                  meeting: (chunks) => (
                    <a
                      href={`#summary-agenda-${note.agendaId}`}
                      onClick={(event) => {
                        event.preventDefault();
                        onSelectAgenda(note.agendaId);
                      }}
                      className="text-[var(--el-body)] underline underline-offset-[3px]"
                    >
                      {chunks}
                    </a>
                  ),
                })
              : t.rich("continuedFrom", {
                  title: note.title ?? t("earlierMeeting"),
                  meeting: (chunks) =>
                    workspaceId ? (
                      <Link
                        href={`/w/${workspaceId}/notes/${note.noteId}?view=full&tab=summary#summary-agenda-${note.agendaId}`}
                        className="text-[var(--el-body)] underline decoration-[var(--el-hairline-strong)] underline-offset-[3px] hover:text-[var(--el-ink)]"
                      >
                        {chunks}
                      </Link>
                    ) : (
                      chunks
                    ),
                })}
          </span>
        </span>
      ))}
      {mapHref ? (
        <Link
          href={mapHref}
          className="underline decoration-[var(--el-hairline-strong)] underline-offset-[3px] hover:text-[var(--el-ink)]"
        >
          {t("openMap")}
        </Link>
      ) : null}
    </span>
  );
}

function TopicRow({
  topic,
  noteId,
  onSelectAgenda,
  mark,
  open,
  onToggle,
  onOpenTimeline,
  links,
  workspaceId,
  projectId,
}: {
  topic: TopicDigest;
  noteId?: string;
  onSelectAgenda: (agendaId: string) => void;
  mark: { nonce: number; holdMs?: number } | null;
  open: boolean;
  onToggle: () => void;
  onOpenTimeline?: (agendaId: string | null) => void;
  links?: MeetingLinkIndex;
  workspaceId?: string;
  projectId?: string;
}) {
  const t = useTranslations("notes.review.topics");
  const continued = topic.agendaId
    ? (links?.byAgendaId.get(topic.agendaId) ?? [])
    : [];

  const counts = [
    ["decision", topic.decisions.length],
    ["task", topic.tasks.length],
    ["open", topic.open.length],
  ] as const;
  const body = open ? (topic.text ?? topic.gist) : topic.gist;
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
        className={cn(
          continued.length > 0 ? "pb-1" : "pb-3",
          "-mx-2 grid w-[calc(100%+16px)] grid-cols-[44px_minmax(0,1fr)_16px] items-start gap-x-3 rounded-control px-2 pt-3 text-left hover:bg-[var(--el-canvas-soft)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--el-ink)] sm:grid-cols-[56px_minmax(0,1fr)_auto_16px]"
        )}
      >
        <span className="text-xs leading-6 tabular-nums text-[var(--el-muted)]">
          {topic.startMs === null ? "" : formatOffset(topic.startMs)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] leading-6 font-medium text-[var(--el-ink)]">
            {mark === null ? (
              topic.title
            ) : (
              <span
                key={mark.nonce}
                {...evidenceMarkOf(topic.title, { holdMs: mark.holdMs }).props}
              >
                {topic.title}
              </span>
            )}
          </span>
          {body ? (
            <span
              className={cn(
                "text-[13.5px] leading-6 whitespace-pre-wrap break-words",
                open ? "text-[var(--el-body)]" : "text-[var(--el-muted)]"
              )}
            >
              {body}
            </span>
          ) : null}
        </span>
        <span className="col-start-2 row-start-2 mt-1 flex h-6 items-center gap-2.5 text-xs whitespace-nowrap tabular-nums text-[var(--el-muted)] sm:col-start-3 sm:row-start-1 sm:mt-0">
          {counts.map(([tone, count]) => (
            <span key={tone} className="inline-flex w-8 items-center gap-1">
              {count > 0 ? (
                <>
                  <TimelineToneIcon tone={tone} />
                  <span className="sr-only">{t(`counts.${tone}`)} </span>
                  {count}
                </>
              ) : null}
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
        <div className="pb-3 pl-[56px] sm:pl-[68px]">
          <ContinuedFrom
            notes={continued}
            workspaceId={workspaceId}
            noteId={noteId}
            onSelectAgenda={onSelectAgenda}
            mapHref={
              workspaceId && projectId && topic.agendaId
                ? `/w/${workspaceId}/projects/${projectId}?agenda=${topic.agendaId}`
                : undefined
            }
          />
        </div>
      ) : null}
      <Collapse open={open} lazy>
        <div className="flex flex-col gap-3 pb-[18px] pl-0 sm:pr-7 sm:pl-[68px]">
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
                    <span className="sr-only">{t(`counts.${tone}`)} · </span>
                    {item.content}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {onOpenTimeline ? (
            <button
              type="button"
              onClick={() => onOpenTimeline(topic.agendaId)}
              className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
            >
              {span ? t("openTimelineAt", { span }) : t("openTimeline")}
              <ArrowUpRight aria-hidden className="size-3" />
            </button>
          ) : null}
        </div>
      </Collapse>
    </li>
  );
}
