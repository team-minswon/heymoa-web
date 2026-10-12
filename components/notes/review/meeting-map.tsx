"use client";

import { useState } from "react";

import { ROLE_COLOR } from "@/components/notes/review/role-dot";
import { tickLabel, ticksOf } from "@/lib/notes/review/moments";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

export type MapMark = { itemId: string; kind: "DECISION" | "ACTION_ITEM"; atMs: number; content: string };
export type MapChapter = { ordinal: number; title: string; startMs: number };

const MARK = {
  DECISION: { name: "결정", color: ROLE_COLOR.DECISION },
  ACTION_ITEM: { name: "할 일", color: ROLE_COLOR.ACTION },
} as const;

const at = (ms: number, lengthMs: number) => `${Math.min(100, Math.max(0, (ms / lengthMs) * 100)).toFixed(2)}%`;

/**
 * 막대 위에서 겹치는 표시를 한 묶음으로 모은다. 같은 줄을 인용한 항목은 때가 같아 완전히 포개지고,
 * 포개지면 위에 그린 것만 눌린다. 바로 앞 표시와 막대 길이의 1.2% 안이면 같은 묶음이다 — 표시는 3px 이고
 * 누를 자리를 넓히지 않으므로, 막대가 250px 이상이면 묶이지 않은 이웃끼리 겹치지 않는다. 고정 칸으로
 * 자르면 칸 경계 양쪽의 두 표시가 따로 묶여 다시 포개진다.
 */
export function groupMarks(marks: readonly MapMark[], lengthMs: number): MapMark[][] {
  const gap = lengthMs * 0.012;
  const groups: MapMark[][] = [];
  for (const mark of [...marks].sort((a, b) => a.atMs - b.atMs)) {
    const last = groups[groups.length - 1];
    if (last && mark.atMs - last[last.length - 1].atMs <= gap) last.push(mark);
    else groups.push([mark]);
  }
  return groups;
}

/**
 * 「언제 정해졌나」(APP-865). 회의 길이 위에 주제 구간을 깔고, 결정 · 할 일이 나온 때를 색 막대로 찍는다 —
 * 회의의 어느 대목에서 결론이 몰렸는지 한눈에 보인다. 막대를 누르면 그 줄을 펼치고 그 자리로 간다.
 * 때를 아는 항목이 하나도 없으면 서지 않는다.
 */
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
  // 묶음마다 몇 번 눌렀나. 누를 때마다 묶음 안의 다음 항목으로 간다
  const [turns, setTurns] = useState<Record<string, number>>({});
  if (marks.length === 0 || lengthMs <= 0) return null;
  const ordered = [...chapters].sort((a, b) => a.startMs - b.startMs);
  const count = (kind: MapMark["kind"]) => marks.filter((mark) => mark.kind === kind).length;
  const ticks = ticksOf(lengthMs);
  const lastTick = ticks[ticks.length - 1];

  return (
    <section
      aria-label="언제 정해졌나"
      className="mt-[26px] rounded-[12px] border border-[var(--el-hairline-soft)] px-4 pt-3.5 pb-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[var(--el-muted)]">
        <h2 className="font-medium text-[var(--el-body)]">언제 정해졌나</h2>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-[5px]">
            <span aria-hidden className="h-1.5 w-3 rounded-[2px] bg-[var(--el-hairline)]" />
            주제 구간
          </span>
          {(["DECISION", "ACTION_ITEM"] as const).map((kind) =>
            count(kind) > 0 ? (
              <span key={kind} className="inline-flex items-center gap-[5px] tabular-nums">
                <span aria-hidden className="h-2.5 w-[3px] rounded-[2px]" style={{ background: MARK[kind].color }} />
                {MARK[kind].name} {count(kind)}
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
              style={{ left: at(chapter.startMs, lengthMs), width: `calc(${at(end - chapter.startMs, lengthMs)} - 2px)` }}
            />
          );
        })}
        {groupMarks(marks, lengthMs).map((group) => {
          const key = group[0].itemId;
          // 묶음은 누를 때마다 다음 항목으로 넘어간다 — 같은 때의 항목 모두에 닿는다.
          const next = group[(turns[key] ?? 0) % group.length];
          const label =
            group.length === 1
              ? `${MARK[next.kind].name} · ${formatOffset(next.atMs)} · ${next.content}`
              : `${formatOffset(group[0].atMs)} · ${group.length}개 · ${group
                  .map((mark) => `${MARK[mark.kind].name} ${mark.content}`)
                  .join(" / ")}`;
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => {
                setTurns((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));
                onSelect(next.itemId);
              }}
              // 누를 자리를 옆으로 넓히지 않는다 — 넓히면 가까운 이웃의 표시를 덮어 다른 항목이 열린다.
              // 위아래로만 넓힌다. 묶음은 조금 길게 그린다.
              className={cn(
                "absolute -ml-[1.5px] w-[3px] rounded-[2px] transition-transform duration-200 ease-out before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:scale-y-[1.35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)] motion-reduce:transition-none",
                group.length === 1 ? "top-1.5 h-3.5" : "top-1 h-[18px]"
              )}
              style={{ left: at(group[0].atMs, lengthMs), background: MARK[group[0].kind].color }}
            />
          );
        })}
      </div>
      <div aria-hidden className="relative h-4 text-[11px] tabular-nums text-[var(--el-muted-soft)]">
        {ticks.map((minute) => (
          <span
            key={minute}
            className="absolute top-0 whitespace-nowrap"
            style={{
              left: `${(minute / lastTick) * 100}%`,
              transform: minute === 0 ? "none" : minute === lastTick ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {tickLabel(minute)}
          </span>
        ))}
      </div>
    </section>
  );
}
