"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ROLE_COLOR } from "@/components/notes/review/role-dot";
import { tickLabel, ticksOf } from "@/lib/notes/review/moments";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

export type MapMark = {
  itemId: string;
  kind: "DECISION" | "ACTION_ITEM";
  atMs: number;
  content: string;
};
export type MapChapter = { ordinal: number; title: string; startMs: number };

const MARK_COLOR = {
  DECISION: ROLE_COLOR.DECISION,
  ACTION_ITEM: ROLE_COLOR.ACTION,
} as const;

const at = (ms: number, lengthMs: number) =>
  `${Math.min(100, Math.max(0, (ms / lengthMs) * 100)).toFixed(2)}%`;

export function groupMarks(
  marks: readonly MapMark[],
  lengthMs: number
): MapMark[][] {
  const gap = lengthMs * 0.012;
  const groups: MapMark[][] = [];
  for (const mark of [...marks].sort((a, b) => a.atMs - b.atMs)) {
    const last = groups[groups.length - 1];
    if (last && mark.atMs - last[last.length - 1].atMs <= gap) last.push(mark);
    else groups.push([mark]);
  }
  return groups;
}

export function MeetingMap({
  lengthMs,
  chapters,
  marks,
  onSelect,
}: {
  lengthMs: number;
  chapters: readonly MapChapter[];
  marks: readonly MapMark[];
  onSelect: (itemId: string) => void;
}) {
  const t = useTranslations("notes.review.map");
  const tKind = useTranslations("notes.kinds");
  const [turns, setTurns] = useState<Record<string, number>>({});
  if (marks.length === 0 || lengthMs <= 0) return null;
  const ordered = [...chapters].sort((a, b) => a.startMs - b.startMs);
  const count = (kind: MapMark["kind"]) =>
    marks.filter((mark) => mark.kind === kind).length;
  const ticks = ticksOf(lengthMs);
  const lastTick = ticks[ticks.length - 1];

  return (
    <section
      aria-label={t("title")}
      className="mt-[26px] rounded-[12px] border border-[var(--el-hairline-soft)] px-4 pt-3.5 pb-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[var(--el-muted)]">
        <h2 className="font-medium text-[var(--el-body)]">{t("title")}</h2>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-[5px]">
            <span
              aria-hidden
              className="h-1.5 w-3 rounded-[2px] bg-[var(--el-hairline)]"
            />
            {t("chapters")}
          </span>
          {(["DECISION", "ACTION_ITEM"] as const).map((kind) =>
            count(kind) > 0 ? (
              <span
                key={kind}
                className="inline-flex items-center gap-[5px] tabular-nums"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-[3px] rounded-[2px]"
                  style={{ background: MARK_COLOR[kind] }}
                />
                {tKind(kind)} {count(kind)}
              </span>
            ) : null
          )}
        </span>
      </div>
      <div className="relative mt-2 h-[26px]">
        {ordered.map((chapter, index) => {
          const end = ordered[index + 1]?.startMs ?? lengthMs;
          return (
            <span
              key={chapter.ordinal}
              title={chapter.title}
              aria-hidden
              className="absolute top-2.5 h-1.5 rounded-[2px] bg-[var(--el-hairline)]"
              style={{
                left: at(chapter.startMs, lengthMs),
                width: `calc(${at(end - chapter.startMs, lengthMs)} - 2px)`,
              }}
            />
          );
        })}
        {groupMarks(marks, lengthMs).map((group) => {
          const key = group[0].itemId;
          const next = group[(turns[key] ?? 0) % group.length];
          const label =
            group.length === 1
              ? `${tKind(next.kind)} · ${formatOffset(next.atMs)} · ${next.content}`
              : `${formatOffset(group[0].atMs)} · ${t("groupCount", { count: group.length })} · ${group
                  .map((mark) => `${tKind(mark.kind)} ${mark.content}`)
                  .join(" / ")}`;
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => {
                setTurns((current) => ({
                  ...current,
                  [key]: (current[key] ?? 0) + 1,
                }));
                onSelect(next.itemId);
              }}
              className={cn(
                "absolute -ml-[1.5px] w-[3px] rounded-[2px] transition-transform duration-200 ease-out before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:scale-y-[1.35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)] motion-reduce:transition-none",
                group.length === 1 ? "top-1.5 h-3.5" : "top-1 h-[18px]"
              )}
              style={{
                left: at(group[0].atMs, lengthMs),
                background: MARK_COLOR[group[0].kind],
              }}
            />
          );
        })}
      </div>
      <div
        aria-hidden
        className="relative h-4 text-[11px] tabular-nums text-[var(--el-muted)]"
      >
        {ticks.map((minute) => (
          <span
            key={minute}
            className="absolute top-0 whitespace-nowrap"
            style={{
              left: `${(minute / lastTick) * 100}%`,
              transform:
                minute === 0
                  ? "none"
                  : minute === lastTick
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            {tickLabel(minute, {
              minutes: (count) => t("tickMinutes", { count }),
              hours: (count) => t("tickHours", { count }),
            })}
          </span>
        ))}
      </div>
    </section>
  );
}
