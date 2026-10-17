"use client";

import { useState, type ReactNode } from "react";

import { ChevronDown, ChevronLeft, ChevronRight, Users } from "lucide-react";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import type { SpeakerStat } from "@/lib/notes/speaker-stats";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

/**
 * 전사 아래 중앙에 떠 있는 **화자 도크**. 화자마다 한 줄이고 가로축은 회의 시간이다.
 *
 * 패널은 열어야 보이고 이동하면 닫혀서, 같은 화자의 다음 발화로 가려면 매번 다시 열어야 했다.
 * 도크는 전사를 읽는 내내 붙어 있다.
 *
 * **지금 위치는 저장하지 않고 [currentMs] 에서 계산한다.** 마지막으로 누른 번호를 기억하면
 * 직접 스크롤했을 때 어긋난다. 세로선이 화면 맨 위 발화의 시각을 따라간다.
 */

/** 같은 발화에 머물러 있을 때 ◀ ▶ 가 제자리를 가리키지 않게 두는 여유. */
const EPSILON_MS = 500;

function ticksOf(stat: SpeakerStat) {
  return stat.jumpStartsMs.map((start, index) => ({
    start,
    segmentId: stat.jumpTargets[index],
  }));
}

function DockRow({
  stat,
  durationMs,
  currentMs,
  active,
  assign,
  onJump,
}: {
  stat: SpeakerStat;
  durationMs: number;
  currentMs: number;
  active: boolean;
  assign: ReactNode;
  onJump: (segmentId: string) => void;
}) {
  const ticks = ticksOf(stat);
  const prev = [...ticks].reverse().find((t) => t.start < currentMs - EPSILON_MS);
  const next = ticks.find((t) => t.start > currentMs + EPSILON_MS);
  const [hover, setHover] = useState<number | null>(null);

  const seek = (ratio: number) => {
    if (!ticks.length) return;
    const at = ratio * durationMs;
    onJump((ticks.find((t) => t.start >= at) ?? ticks[ticks.length - 1]).segmentId);
  };
  const ratioOf = (event: { clientX: number; currentTarget: HTMLElement }) => {
    const box = event.currentTarget.getBoundingClientRect();
    return box.width > 0
      ? Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
      : 0;
  };

  return (
    <li
      data-testid="speaker-dock-row"
      data-active={active || undefined}
      className={cn(
        "flex items-center gap-2 rounded-chip px-1.5 py-1",
        active && "bg-[var(--el-canvas-soft)]"
      )}
    >
      <div className="flex w-28 shrink-0 items-center gap-1.5">
        {/* 미지정이면 지정 메뉴(칩이 얼굴을 품는다), 아니면 이름만 — 이름 붙은 줄을 여기서 다시 바꾸는 것은 전사의 칩이 맡는다. */}
        {assign ?? (
          <>
            <PersonAvatar name={stat.avatarName} image={stat.image} size={18} />
            <span className="truncate text-[12px] text-[var(--el-ink)]">
              {stat.name}
            </span>
          </>
        )}
      </div>

      <div
        data-testid="speaker-dock-strip"
        className="relative h-5 flex-1 cursor-pointer"
        onPointerMove={(event) => setHover(ratioOf(event))}
        onPointerLeave={() => setHover(null)}
        onClick={(event) => seek(ratioOf(event))}
      >
        <div className="flex h-full items-center gap-px">
          {stat.timeline.map((value, bin) => (
            <span
              key={bin}
              className="h-full flex-1 rounded-[1px] bg-[var(--el-ink)]"
              style={{ opacity: value > 0 ? 0.2 + value * 0.8 : 0.07 }}
            />
          ))}
        </div>
        {/* 지금 위치. 줄마다 같은 비율에 서서 세로로 이어져 보인다. */}
        <span
          aria-hidden
          data-testid="speaker-dock-now"
          className="pointer-events-none absolute inset-y-0 w-px bg-[var(--el-scope-project)]"
          style={{ left: `${Math.min(1, Math.max(0, currentMs / durationMs)) * 100}%` }}
        />
        {hover === null ? null : (
          <span
            className="pointer-events-none absolute -top-5 z-20 -translate-x-1/2 rounded-chip bg-[var(--el-ink)] px-1.5 py-0.5 text-[10px] tabular-nums leading-none text-[var(--el-on-primary)]"
            style={{ left: `${Math.min(88, Math.max(12, hover * 100))}%` }}
          >
            {formatOffset(hover * durationMs)}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          aria-label={`${stat.name} 이전 발화`}
          disabled={!prev}
          onClick={() => prev && onJump(prev.segmentId)}
          className="rounded-chip p-0.5 text-[var(--el-muted)] hover:bg-[var(--el-canvas-soft)] disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`${stat.name} 다음 발화`}
          disabled={!next}
          onClick={() => next && onJump(next.segmentId)}
          className="rounded-chip p-0.5 text-[var(--el-muted)] hover:bg-[var(--el-canvas-soft)] disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

export function SpeakerDock({
  stats: allStats,
  durationMs,
  currentMs,
  onJump,
  renderAssign,
}: {
  stats: SpeakerStat[];
  durationMs: number;
  /** 화면 맨 위에 보이는 발화의 시각. 스크롤을 따라간다. */
  currentMs: number;
  onJump: (segmentId: string) => void;
  /** 미지정 화자 줄의 이름 자리. 지정 메뉴를 그대로 넘긴다. 없으면 이름만 그린다. */
  renderAssign: (stat: SpeakerStat) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // 말한 기록이 없는 참여자는 줄에 그릴 것이 없다(패널에는 선다).
  const stats = allStats.filter((stat) => stat.jumpTargets.length > 0);
  if (!stats.length || durationMs <= 0) return null;

  // 지금 시각에 가장 가까운 앞선 발화를 가진 화자가 말하는 중이다.
  let activeKey: string | null = null;
  let best = Infinity;
  for (const stat of stats) {
    for (const start of stat.jumpStartsMs) {
      const gap = currentMs - start;
      if (gap >= -EPSILON_MS && gap < best) {
        best = gap;
        activeKey = stat.key;
      }
    }
  }
  const unassigned = stats.filter((stat) => stat.unassigned).length;

  return (
    <div
      data-testid="speaker-dock"
      className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3 lg:bottom-4"
    >
      <div className="pointer-events-auto w-[min(34rem,100%)] rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)]/95 p-1.5 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-1.5 rounded-chip px-1.5 py-0.5 text-[11px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
        >
          <Users className="size-3.5" />
          화자 도크
          {unassigned ? ` · 이름 없음 ${unassigned}` : ""}
          <ChevronDown
            className={cn("ml-auto size-3.5 transition-transform", collapsed && "rotate-180")}
          />
        </button>
        {collapsed ? null : (
          <div className="relative mt-0.5 max-h-40 overflow-y-auto">
            <ul className="relative">
              {stats.map((stat) => (
                <DockRow
                  key={stat.key}
                  stat={stat}
                  durationMs={durationMs}
                  currentMs={currentMs}
                  active={stat.key === activeKey}
                  assign={stat.unassigned ? renderAssign(stat) : null}
                  onJump={onJump}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
