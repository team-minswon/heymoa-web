"use client";

import { useState, type ReactNode } from "react";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";

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

/**
 * 화자 색. 아바타 파스텔 다섯의 hue 를 **글자 없는 막대에 쓸 만큼 깊게** 올렸다 — 파스텔 그대로는
 * 흰 유리 위에서 안 보인다. 줄 순서로 돌려 쓰므로 한 회의 안에서는 줄마다 다르고(다섯 명까지),
 * 같은 줄은 도크가 열려 있는 동안 늘 같은 색이다.
 */
const TONES = ["#4fb59d", "#e79468", "#6f9fd8", "#9a84d4", "#df7f98"];

/** 줄 높이(px). 막대의 최대 높이가 이 안에 든다. */
const ROW_H = 24;

function ticksOf(stat: SpeakerStat) {
  return stat.jumpStartsMs.map((start, index) => ({
    start,
    segmentId: stat.jumpTargets[index],
  }));
}

function DockRow({
  stat,
  tone,
  durationMs,
  currentMs,
  active,
  assign,
  onJump,
}: {
  stat: SpeakerStat;
  tone: string;
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
  const now = Math.min(1, Math.max(0, currentMs / durationMs));
  const reduced = useReducedMotion();

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
      style={{ height: ROW_H }}
      className="group flex items-center gap-2"
    >
      <div
        className={cn(
          "flex w-[6.5rem] shrink-0 items-center gap-1.5 text-[12px] transition-colors",
          active ? "font-medium text-[var(--el-ink)]" : "text-[var(--el-muted)]"
        )}
      >
        {/* 미지정이면 지정 메뉴(칩이 얼굴을 품는다), 아니면 이름만 — 이름 붙은 줄을 여기서 다시 바꾸는 것은 전사의 칩이 맡는다. */}
        {assign ?? (
          <>
            <PersonAvatar name={stat.avatarName} image={stat.image} size={16} />
            <span className="truncate">{stat.name}</span>
          </>
        )}
      </div>

      <div
        data-testid="speaker-dock-strip"
        className="relative h-full flex-1 cursor-pointer"
        onPointerMove={(event) => setHover(ratioOf(event))}
        onPointerLeave={() => setHover(null)}
        onClick={(event) => seek(ratioOf(event))}
      >
        {/* 파형. 말한 양이 높이고, 말 없는 칸은 점으로 남아 회의 축이 이어진다. */}
        <div className="flex h-full items-center gap-[2px]">
          {stat.timeline.map((value, bin) => (
            // 처음 그릴 때 왼쪽에서 오른쪽으로 차례로 자란다 — 회의가 시간순으로 펼쳐진다는 것을 말한다.
            <motion.span
              key={bin}
              initial={reduced ? false : { scaleY: 0, opacity: 0 }}
              animate={{
                scaleY: 1,
                opacity: value > 0 ? (active ? 1 : 0.55 + value * 0.3) : 0.18,
              }}
              transition={{
                duration: 0.28,
                ease: "easeOut",
                delay: reduced ? 0 : Math.min(bin * 0.006, 0.3),
              }}
              className="flex-1 rounded-full"
              style={{
                height: Math.max(2, Math.round(value * (ROW_H - 6))),
                backgroundColor: tone,
              }}
            />
          ))}
        </div>
        {/* 지금 위치. 줄마다 같은 비율에 서서 세로로 이어진다. 말하는 줄에만 점이 얹힌다. */}
        <span
          aria-hidden
          data-testid="speaker-dock-now"
          className="pointer-events-none absolute inset-y-0 w-px bg-[var(--el-ink)]/70 transition-[left] duration-150 ease-out"
          style={{ left: `${now * 100}%` }}
        >
          {active ? (
            <span
              className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
              style={{ backgroundColor: tone }}
            />
          ) : null}
        </span>
        <AnimatePresence>
          {hover === null ? null : (
            // 커서 옆, 줄 안에 선다 — 위로 띄우면 첫 줄은 도크 바깥(스크롤 영역)에 잘려 안 보인다.
            <motion.span
              initial={reduced ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.12 }}
              className={cn(
                "pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 rounded-full bg-[var(--el-ink)] px-2 py-1 text-[10px] tabular-nums leading-none text-[var(--el-on-primary)] shadow-sm",
                hover > 0.8 ? "-translate-x-full -ml-2" : "ml-2"
              )}
              style={{ left: `${hover * 100}%` }}
            >
              {formatOffset(hover * durationMs)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* 평소엔 옅게, 줄에 올리거나 활성일 때 또렷하게. 키보드로 닿으면 바로 보인다. */}
      <div
        className={cn(
          "flex shrink-0 items-center transition-opacity focus-within:opacity-100 group-hover:opacity-100",
          active ? "opacity-100" : "opacity-40"
        )}
      >
        <button
          type="button"
          aria-label={`${stat.name} 이전 발화`}
          disabled={!prev}
          onClick={() => prev && onJump(prev.segmentId)}
          className="rounded-full p-0.5 text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)] disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`${stat.name} 다음 발화`}
          disabled={!next}
          onClick={() => next && onJump(next.segmentId)}
          className="rounded-full p-0.5 text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)] disabled:opacity-30"
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
  const reduced = useReducedMotion();
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
    <motion.div
      data-testid="speaker-dock"
      // 처음 나타날 때 아래에서 살짝 올라온다.
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3 lg:bottom-4"
    >
      <AnimatePresence mode="wait" initial={false}>
        {collapsed ? (
          // 접으면 아바타만 보이는 작은 알약. 누르면 펼쳐진다.
          <motion.button
            key="pill"
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="화자 도크 펼치기"
            aria-expanded={false}
            initial={reduced ? false : { opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-white/80 py-1.5 pl-2 pr-3 shadow-lg backdrop-blur-xl hover:bg-white"
          >
            <span className="flex -space-x-1.5">
              {stats.slice(0, 5).map((stat) => (
                <span key={stat.key} className="rounded-full ring-2 ring-white">
                  <PersonAvatar name={stat.avatarName} image={stat.image} size={18} />
                </span>
              ))}
            </span>
            <span className="text-[11px] text-[var(--el-muted)]">
              {unassigned ? `이름 없음 ${unassigned}` : `화자 ${stats.length}`}
            </span>
            <ChevronsUpDown className="size-3 text-[var(--el-muted)]" />
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            initial={reduced ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ transformOrigin: "bottom center" }}
            className="pointer-events-auto w-[min(32rem,100%)] rounded-2xl border border-[var(--el-hairline)] bg-white/80 px-3 pb-2 pt-1.5 shadow-xl backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="화자 도크 접기"
              aria-expanded
              className="group mx-auto mb-1 flex w-full items-center justify-center gap-1.5 text-[10px] text-[var(--el-muted-soft)] hover:text-[var(--el-ink)]"
            >
              <span className="h-[3px] w-8 rounded-full bg-[var(--el-hairline-strong)] transition-colors group-hover:bg-[var(--el-muted-soft)]" />
              {unassigned ? `이름 없음 ${unassigned}` : null}
            </button>
            <ul className="max-h-40 overflow-y-auto">
              {stats.map((stat, index) => (
                <DockRow
                  key={stat.key}
                  stat={stat}
                  tone={TONES[index % TONES.length]}
                  durationMs={durationMs}
                  currentMs={currentMs}
                  active={stat.key === activeKey}
                  assign={stat.unassigned ? renderAssign(stat) : null}
                  onJump={onJump}
                />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
