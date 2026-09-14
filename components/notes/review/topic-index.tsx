"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Collapse } from "@/components/heymoa/collapse";
import { ShowMoreButton } from "@/components/heymoa/show-more-button";
import { SectionBlock } from "@/components/notes/review/section-block";
import { topicsToMarkdown } from "@/lib/notes/review/markdown";
import { topicNumber, type TopicChip } from "@/lib/notes/review/topics";
import { cn } from "@/lib/utils";

const VISIBLE_TOPICS = 3;

/**
 * 주제 목차. 번호나 칩만으로는 어느 주제인지 안 읽힌다 — 제목과 한 줄 서술, 항목 수를 한 줄씩 세운다.
 * 누르면 그 주제의 항목만 남고, 다시 누르면 푼다.
 */
export function TopicIndex({
  topics,
  topic,
  onTopicChange,
}: {
  topics: readonly TopicChip[];
  topic: number | null;
  onTopicChange: (next: number | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (topics.length === 0) return null;

  const head = topics.slice(0, VISIBLE_TOPICS);
  const rest = topics.slice(VISIBLE_TOPICS);
  const showRest = expanded || rest.some((entry) => entry.ordinal === topic);

  const row = (entry: TopicChip) => (
    <TopicRow
      key={entry.ordinal}
      entry={entry}
      selected={topic === entry.ordinal}
      onSelect={() => onTopicChange(topic === entry.ordinal ? null : entry.ordinal)}
    />
  );

  return (
    <SectionBlock title="주제" count={topics.length} copy={{ build: () => topicsToMarkdown(topics) }}>
      <ul aria-label="주제 목차" className="-mx-2">
        {head.map(row)}
      </ul>
      {rest.length > 0 ? (
        <>
          <Collapse open={showRest} lazy>
            <ul className="-mx-2">{rest.map(row)}</ul>
          </Collapse>
          <ShowMoreButton
            open={showRest}
            moreLabel={`주제 ${rest.length}개 더`}
            onToggle={() => setExpanded((value) => !value)}
            className="pt-2"
          />
        </>
      ) : null}
    </SectionBlock>
  );
}

function TopicRow({
  entry,
  selected,
  onSelect,
}: {
  entry: TopicChip;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li className="border-b border-[var(--el-hairline-soft)] last:border-b-0">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          "grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-control px-2 py-2.5 text-left transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--el-ink)]",
          selected ? "bg-[var(--el-surface-strong)]" : "hover:bg-[var(--el-canvas-soft)]"
        )}
      >
        <span className="font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
          {topicNumber(entry.ordinal)}
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              "block text-sm break-keep text-[var(--el-ink)]",
              selected && "font-semibold"
            )}
          >
            {entry.title}
          </span>
          {entry.gist ? (
            <span className="mt-0.5 block truncate text-[12.5px] text-[var(--el-muted)]">
              {entry.gist}
            </span>
          ) : null}
        </span>
        <span className="text-xs whitespace-nowrap tabular-nums text-[var(--el-muted)]">
          항목 {entry.count}
        </span>
      </button>
    </li>
  );
}

/** 주제로 거른 동안 섹션 위에 붙는다. 무엇으로 거르고 있는지와 푸는 길을 한 줄에 둔다. */
export function TopicFilterBar({
  entry,
  onClear,
}: {
  entry: TopicChip;
  onClear: () => void;
}) {
  return (
    <div
      role="status"
      className="sticky top-0 z-10 mt-2 flex items-center gap-2.5 rounded-control bg-[var(--el-surface-strong)] px-3 py-2 text-[13px] animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none"
    >
      <span className="font-mono text-[11px] whitespace-nowrap text-[var(--el-muted)]">
        주제 {topicNumber(entry.ordinal)}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--el-ink)]">{entry.title}</span>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--el-muted)] hover:text-[var(--el-ink)]"
      >
        <X aria-hidden className="size-3.5" />
        전체 보기
      </button>
    </div>
  );
}
