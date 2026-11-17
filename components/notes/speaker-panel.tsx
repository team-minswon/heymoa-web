"use client";

import { useEffect, useRef, useState } from "react";

import { motion, useReducedMotion } from "motion/react";
import { CornerDownRight, RotateCcw, SkipForward, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  jumpIndexAt,
  speakingTimeParts,
  type SpeakerJumpVia,
  type SpeakerStat,
  type SpeakerUtterance,
} from "@/lib/notes/speaker-stats";
import { formatOffset } from "@/lib/transcription/presentation";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { cn } from "@/lib/utils";

const ROW_STAGGER_S = 0.035;

function Sparkline({
  timeline,
  dim,
  durationMs,
  utterances,
  steps,
  current,
  onPick,
}: {
  timeline: number[];
  dim: boolean;
  durationMs: number;
  utterances: SpeakerUtterance[];
  steps: SpeakerUtterance[];
  current: number;
  onPick: (utterance: SpeakerUtterance) => void;
}) {
  const clickable = utterances.length > 0 && durationMs > 0;
  const [hover, setHover] = useState<number | null>(null);
  const ratioOf = (event: { clientX: number; currentTarget: HTMLElement }) => {
    const box = event.currentTarget.getBoundingClientRect();
    return box.width > 0
      ? Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
      : 0;
  };
  return (
    <div
      aria-hidden
      data-testid="speaker-panel-strip"
      className={cn("relative", clickable && "cursor-pointer")}
      onPointerMove={(event) => setHover(ratioOf(event))}
      onPointerLeave={() => setHover(null)}
      onClick={(event) => {
        if (!clickable) return;
        const index = jumpIndexAt(utterances, ratioOf(event) * durationMs);
        if (index >= 0) onPick(utterances[index]);
      }}
    >
      <div className={cn("flex h-6 items-end gap-px", dim && "opacity-45")}>
        {timeline.map((value, bin) => (
          <span
            key={bin}
            className="min-h-px flex-1 rounded-[1px] bg-current"
            style={{
              height: `${Math.max(3, value * 100)}%`,
              opacity: value > 0 ? 0.25 + value * 0.75 : 0.12,
            }}
          />
        ))}
      </div>
      {hover === null ? null : (
        <>
          <span
            className="pointer-events-none absolute inset-y-0 w-px bg-[var(--el-ink)] opacity-40"
            style={{ left: `${hover * 100}%` }}
          />
          <span
            data-testid="speaker-panel-strip-time"
            className="pointer-events-none absolute -top-5 z-20 -translate-x-1/2 rounded-chip bg-[var(--el-ink)] px-1.5 py-0.5 text-[10px] tabular-nums leading-none text-[var(--el-on-primary)]"
            style={{ left: `${Math.min(88, Math.max(12, hover * 100))}%` }}
          >
            {formatOffset(hover * durationMs)}
          </span>
        </>
      )}
      {clickable ? (
        <div className="relative mt-0.5 h-1">
          {steps.map(({ startedAtMs: start }, index) => (
            <span
              key={index}
              className={cn(
                "absolute top-0 size-1 -translate-x-1/2 rounded-full",
                index === current
                  ? "z-10 scale-150 bg-[var(--el-scope-project)]"
                  : "bg-[var(--el-muted-soft)]"
              )}
              style={{ left: `${Math.min(100, (start / durationMs) * 100)}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SpeakerRow({
  stat,
  index,
  lastSegmentId,
  durationMs,
  onJump,
}: {
  stat: SpeakerStat;
  index: number;
  lastSegmentId: string | undefined;
  durationMs: number;
  onJump: (segmentId: string, via: SpeakerJumpVia) => void;
}) {
  const t = useTranslations("notes.speakers.panel");
  const tSpeakers = useTranslations("notes.speakers");
  const reduced = useReducedMotion();
  const silent = stat.speakingMs === 0;
  const targets = stat.stepTargets;
  const last = stat.utterances.find((u) => u.segmentId === lastSegmentId);
  const position = last
    ? targets.findIndex((u) => u.segmentId === last.segmentId)
    : -1;
  const after = last
    ? targets.findIndex((u) => u.startedAtMs > last.startedAtMs)
    : 0;
  const next = () => {
    if (targets.length === 0) return;
    onJump(targets[Math.max(0, after)].segmentId, "step");
  };

  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        delay: Math.min(index * ROW_STAGGER_S, 0.25),
      }}
      data-testid="speaker-panel-row"
      data-unassigned={stat.unassigned || undefined}
      className="border-b border-[var(--el-hairline)] px-4 py-3 last:border-b-0"
    >
      <div className="flex items-center gap-2">
        <PersonAvatar
          name={stat.avatarName}
          image={stat.image}
          size={24}
          className={cn(silent && "opacity-45")}
        />
        <span className="truncate text-[13px] font-medium text-[var(--el-ink)]">
          {stat.name}
        </span>
        <span className="ml-auto shrink-0 tabular-nums text-[11px] text-[var(--el-muted)]">
          {silent
            ? t("silent")
            : t("share", { percent: Math.round(stat.share * 100) })}
        </span>
      </div>

      {silent ? null : (
        <div className="mt-2 pl-8 text-[var(--el-ink)]">
          <Sparkline
            timeline={stat.timeline}
            dim={stat.unassigned}
            durationMs={durationMs}
            utterances={stat.utterances}
            steps={targets}
            current={position}
            onPick={(utterance) => onJump(utterance.segmentId, "strip")}
          />
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--el-muted-soft)]">
            <span className="tabular-nums">
              {tSpeakers("speakingTime", speakingTimeParts(stat.speakingMs))}
            </span>
            {targets.length > 0 ? (
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto -mr-1 text-[var(--el-muted)]"
                onClick={next}
              >
                <CornerDownRight data-icon="inline-start" />
                {!last
                  ? stat.unassigned
                    ? t("goAssign")
                    : t("firstLine")
                  : t("nextLine")}
                {targets.length > 1 ? (
                  <span className="tabular-nums text-[var(--el-muted-soft)]">
                    {position < 0
                      ? t("spots", { count: targets.length })
                      : t("position", {
                          current: position + 1,
                          total: targets.length,
                        })}
                  </span>
                ) : null}
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {stat.firstStartedAtMs === null ? null : (
        <span className="sr-only">
          {t("firstAt", { time: formatOffset(stat.firstStartedAtMs) })}
        </span>
      )}
    </motion.li>
  );
}

export function SpeakerPanel({
  open,
  onOpenChange,
  stats,
  durationMs,
  onJump,
  onReset,
  resetting,
  resettable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: SpeakerStat[];
  durationMs: number;
  onJump: (segmentId: string, via: SpeakerJumpVia) => void;
  onReset: () => void;
  resetting: boolean;
  resettable: boolean;
}) {
  const t = useTranslations("notes.speakers.panel");
  const tSpeakers = useTranslations("notes.speakers");
  const unassigned = stats.filter((stat) => stat.unassigned);
  const assigned = stats.filter((stat) => !stat.unassigned);

  const pendingJump = useRef<{ segmentId: string; via: SpeakerJumpVia } | null>(
    null
  );
  const skipReturnFocus = useRef(false);
  useEffect(() => {
    if (open) {
      pendingJump.current = null;
      skipReturnFocus.current = false;
    }
  }, [open]);
  const [lastByKey, setLastByKey] = useState<Record<string, string>>({});
  const jump = (key: string) => (segmentId: string, via: SpeakerJumpVia) => {
    setLastByKey((all) => ({ ...all, [key]: segmentId }));
    pendingJump.current = { segmentId, via };
    skipReturnFocus.current = true;
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(next) => {
        if (!next && pendingJump.current) {
          const { segmentId, via } = pendingJump.current;
          pendingJump.current = null;
          onJump(segmentId, via);
        }
      }}
    >
      <SheetContent
        finalFocus={() => !skipReturnFocus.current}
        side="left"
        className="w-[min(21rem,88vw)] gap-0 rounded-r-panel sm:max-w-none"
      >
        <SheetHeader className="border-b border-[var(--el-hairline)]">
          <SheetTitle className="font-sans text-[13px] font-semibold">
            {t("title")}
          </SheetTitle>
          <SheetDescription>
            {[
              t("participants", { count: assigned.length }),
              unassigned.length
                ? t("unassigned", { count: unassigned.length })
                : null,
              t("meetingLength", {
                time: tSpeakers("speakingTime", speakingTimeParts(durationMs)),
              }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {stats.length ? (
            <ul>
              {[...unassigned, ...assigned].map((stat, index) => (
                <SpeakerRow
                  key={stat.key}
                  stat={stat}
                  index={index}
                  lastSegmentId={lastByKey[stat.key]}
                  durationMs={durationMs}
                  onJump={jump(stat.key)}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-sm text-[var(--el-muted)]">
              {t("empty")}
            </p>
          )}
        </ScrollArea>

        <div className="border-t border-[var(--el-hairline)] p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-[var(--el-muted)]"
            disabled={!resettable}
            loading={resetting}
            onClick={onReset}
          >
            <RotateCcw data-icon="inline-start" />
            {t("reset")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SpeakerTools({
  onOpen,
  onNextUnassigned,
  unassignedCount,
}: {
  onOpen: () => void;
  onNextUnassigned: () => void;
  unassignedCount: number;
}) {
  const t = useTranslations("notes.speakers.tools");
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button type="button" variant="ghost" size="sm" onClick={onOpen} />
          }
        >
          <Users data-icon="inline-start" />
          {t("open")}
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("openHint")}</TooltipContent>
      </Tooltip>

      {unassignedCount ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onNextUnassigned}
              />
            }
          >
            <SkipForward data-icon="inline-start" />
            {t("nextUnassigned", { count: unassignedCount })}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("nextUnassignedHint")}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </>
  );
}
