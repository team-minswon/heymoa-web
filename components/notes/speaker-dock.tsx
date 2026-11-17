"use client";

import { memo, useState, useSyncExternalStore, type ReactNode } from "react";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import {
  jumpIndexAt,
  type SpeakerJumpVia,
  type SpeakerStat,
} from "@/lib/notes/speaker-stats";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

export function createCurrentMsStore() {
  let value = 0;
  let pinned = false;
  const listeners = new Set<() => void>();
  const emit = (next: number) => {
    if (next === value) return;
    value = next;
    listeners.forEach((listener) => listener());
  };
  return {
    get: () => value,
    set(next: number) {
      if (!pinned) emit(next);
    },
    pin(next: number) {
      pinned = true;
      emit(next);
    },
    release() {
      pinned = false;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
export type CurrentMsStore = ReturnType<typeof createCurrentMsStore>;

const EPSILON_MS = 500;

const TONES = ["#4fb59d", "#e79468", "#6f9fd8", "#9a84d4", "#df7f98"];

const ROW_H = 24;

const Wave = memo(function Wave({
  timeline,
  tone,
  active,
  reduced,
}: {
  timeline: number[];
  tone: string;
  active: boolean;
  reduced: boolean;
}) {
  return (
    <div className="flex h-full items-center gap-[2px]">
      {timeline.map((value, bin) => (
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
  );
});

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
  onJump: (segmentId: string, via: SpeakerJumpVia) => void;
}) {
  const t = useTranslations("notes.speakers.dock");
  const steps = stat.utterances;
  const prev = steps.findLast((u) => u.startedAtMs < currentMs);
  const next = steps.find((u) => u.startedAtMs > currentMs);
  const [hover, setHover] = useState<number | null>(null);
  const now = Math.min(1, Math.max(0, currentMs / durationMs));
  const reduced = useReducedMotion();

  const seek = (ratio: number) => {
    const index = jumpIndexAt(stat.utterances, ratio * durationMs);
    if (index >= 0) onJump(stat.utterances[index].segmentId, "strip");
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
        <Wave
          timeline={stat.timeline}
          tone={tone}
          active={active}
          reduced={Boolean(reduced)}
        />
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

      <div
        className={cn(
          "flex shrink-0 items-center transition-opacity focus-within:opacity-100 group-hover:opacity-100",
          active ? "opacity-100" : "opacity-40"
        )}
      >
        <button
          type="button"
          aria-label={t("previous", { name: stat.name })}
          disabled={!prev}
          onClick={() => prev && onJump(prev.segmentId, "step")}
          className="rounded-full p-0.5 text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)] disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={t("next", { name: stat.name })}
          disabled={!next}
          onClick={() => next && onJump(next.segmentId, "step")}
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
  currentMsStore,
  onJump,
  renderAssign,
}: {
  stats: SpeakerStat[];
  durationMs: number;
  currentMsStore: CurrentMsStore;
  onJump: (segmentId: string, via: SpeakerJumpVia) => void;
  renderAssign: (stat: SpeakerStat) => ReactNode;
}) {
  const t = useTranslations("notes.speakers.dock");
  const [collapsed, setCollapsed] = useState(false);
  const reduced = useReducedMotion();
  const currentMs = useSyncExternalStore(
    currentMsStore.subscribe,
    currentMsStore.get,
    () => 0
  );
  const stats = allStats.filter((stat) => stat.utterances.length > 0);
  if (!stats.length || durationMs <= 0) return null;

  let activeKey: string | null = null;
  let best = Infinity;
  let ahead: { key: string; gap: number } | null = null;
  for (const stat of stats) {
    for (const { startedAtMs } of stat.utterances) {
      const gap = currentMs - startedAtMs;
      if (gap >= 0 && gap < best) {
        best = gap;
        activeKey = stat.key;
      } else if (gap < 0 && gap >= -EPSILON_MS && (!ahead || gap > ahead.gap)) {
        ahead = { key: stat.key, gap };
      }
    }
  }
  if (activeKey === null && ahead) activeKey = ahead.key;
  const unassigned = stats.filter((stat) => stat.unassigned).length;

  return (
    <motion.div
      data-testid="speaker-dock"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3 lg:bottom-4"
    >
      <AnimatePresence mode="wait" initial={false}>
        {collapsed ? (
          <motion.button
            key="pill"
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label={t("expand")}
            aria-expanded={false}
            initial={reduced ? false : { opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.92,
              y: 6,
              transition: { duration: 0.12 },
            }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-white/80 py-1.5 pl-2 pr-3 shadow-lg backdrop-blur-xl hover:bg-white"
          >
            <span className="flex -space-x-1.5">
              {stats.slice(0, 5).map((stat) => (
                <span key={stat.key} className="rounded-full ring-2 ring-white">
                  <PersonAvatar
                    name={stat.avatarName}
                    image={stat.image}
                    size={18}
                  />
                </span>
              ))}
            </span>
            <span className="text-[11px] text-[var(--el-muted)]">
              {unassigned
                ? t("unassigned", { count: unassigned })
                : t("speakers", { count: stats.length })}
            </span>
            <ChevronsUpDown className="size-3 text-[var(--el-muted)]" />
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            initial={reduced ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.96,
              y: 8,
              transition: { duration: 0.12 },
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ transformOrigin: "bottom center" }}
            className="pointer-events-auto w-[min(32rem,100%)] rounded-2xl border border-[var(--el-hairline)] bg-white/80 px-3 pb-2 pt-1.5 shadow-xl backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={t("collapse")}
              aria-expanded
              className="group mx-auto -mt-1.5 mb-0.5 flex h-6 items-center justify-center gap-1.5 rounded-full px-6 text-[10px] text-[var(--el-muted-soft)] outline-none transition-colors hover:text-[var(--el-ink)] focus-visible:ring-2 focus-visible:ring-[var(--el-ink)]"
            >
              <span className="h-1 w-11 rounded-full bg-[var(--el-hairline-strong)] transition-colors group-hover:bg-[var(--el-muted)]" />
              {unassigned ? t("unassigned", { count: unassigned }) : null}
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
