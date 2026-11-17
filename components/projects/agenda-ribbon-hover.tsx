"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { animate, type AnimationPlaybackControls } from "motion/react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { FADE_REDUCED, HOVER_IN, HOVER_OUT, reducedMotion } from "@/components/projects/agenda-ribbon-motion";
import { summaryHref } from "@/components/projects/agenda-map-panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMeetingReviewSummary } from "@/lib/api/generated/meeting-review/meeting-review";
import { okData } from "@/lib/api/ok-data";
import { formatAppDate } from "@/lib/format/date";
import { meetingHeading, shortMeetingDate, type MapAgenda, type MapMeeting } from "@/lib/projects/agenda-map";
import { cn } from "@/lib/utils";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

export type FoldPreview = { date: string; title: string; count: number };

export type HoverInfo =
  | {
      rect: DOMRect;
      el?: Element;
      topicName: string | null;
      meeting: MapMeeting;
      agendas: MapAgenda[];
      fold: FoldPreview[];
      foldOnly?: boolean;
      tip?: undefined;
    }
  | {
      rect: DOMRect;
      el?: Element;
      tip: { title: string; text: string };
    };

export type HoverApi = {
  show: (info: HoverInfo) => void;
  hide: (now?: boolean) => void;
  isOpen: () => boolean;
  refresh: () => void;
};

const SHOW_DELAY = 150;
const HIDE_DELAY = 140;
const SLIDE = 4;
export const FILL_AFTER_MS = 450;
const CARD_W = 304;
const CARD_AGENDAS = 3;
const GAP = 8;
const MARGIN = 8;

export function HoverCard({ workspaceId, ref }: { workspaceId: string; ref: React.Ref<HoverApi> }) {
  const [info, setInfo] = useState<HoverInfo | null>(null);
  const openRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<AnimationPlaybackControls | null>(null);
  const shownRef = useRef(false);
  const sideRef = useRef<"top" | "bottom" | "right" | "left" | null>(null);
  const followRef = useRef<(() => void) | null>(null);

  const cancelExit = () => {
    const exit = exitRef.current;
    if (!exit) return;
    exitRef.current = null;
    exit.stop();
    if (cardRef.current) {
      cardRef.current.style.opacity = "";
      cardRef.current.style.pointerEvents = "";
    }
  };
  const close = (fade: boolean) => {
    window.clearTimeout(timerRef.current);
    openRef.current = false;
    const card = cardRef.current;
    if (!fade || !card) {
      cancelExit();
      shownRef.current = false;
      sideRef.current = null;
      setInfo(null);
      return;
    }
    if (exitRef.current) return;
    card.style.pointerEvents = "none";
    const exit = animate(card, { opacity: 0 }, reducedMotion() ? FADE_REDUCED : HOVER_OUT);
    exitRef.current = exit;
    exit.finished.then(() => {
      if (exitRef.current !== exit) return;
      exitRef.current = null;
      shownRef.current = false;
      sideRef.current = null;
      setInfo(null);
    });
  };

  useImperativeHandle(
    ref,
    () => ({
      show: (next) => {
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(
          () => {
            cancelExit();
            openRef.current = true;
            setInfo(next);
          },
          openRef.current ? 60 : SHOW_DELAY
        );
      },
      hide: (now) => {
        window.clearTimeout(timerRef.current);
        if (now) close(false);
        else timerRef.current = window.setTimeout(() => close(true), HIDE_DELAY);
      },
      isOpen: () => openRef.current,
      refresh: () => followRef.current?.(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !info) return;
    const target = info.el;
    const rectOf = () => (target?.isConnected ? target.getBoundingClientRect() : info.rect);
    const clamp = (value: number, low: number, high: number) => Math.min(Math.max(low, high), Math.max(low, value));
    let side: "top" | "bottom" | "right" | "left" | null = sideRef.current;
    const place = (w: number, h: number) => {
      const rect = rectOf();
      const [vw, vh] = [window.innerWidth, window.innerHeight];
      if (!side) {
        const room = { top: rect.top - GAP - MARGIN, bottom: vh - rect.bottom - GAP - MARGIN };
        side =
          room.top >= h
            ? "top"
            : room.bottom >= h
              ? "bottom"
              : rect.right + GAP + w <= vw - MARGIN
                ? "right"
                : rect.left - GAP - w >= MARGIN
                  ? "left"
                  : room.top >= room.bottom
                    ? "top"
                    : "bottom";
        sideRef.current = side;
      }
      const [x, y] =
        side === "top" || side === "bottom"
          ? [
              clamp(rect.left + rect.width / 2 - w / 2, MARGIN, vw - w - MARGIN),
              clamp(side === "top" ? rect.top - GAP - h : rect.bottom + GAP, MARGIN, vh - h - MARGIN),
            ]
          : [
              side === "right" ? rect.right + GAP : rect.left - GAP - w,
              clamp(rect.top + rect.height / 2 - h / 2, MARGIN, vh - h - MARGIN),
            ];
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
    };
    place(card.offsetWidth, card.offsetHeight);
    if (!shownRef.current) {
      shownRef.current = true;
      card.style.opacity = "0";
      if (reducedMotion()) animate(card, { opacity: [0, 1] }, FADE_REDUCED);
      else {
        const [dx, dy] = { top: [0, SLIDE], bottom: [0, -SLIDE], right: [-SLIDE, 0], left: [SLIDE, 0] }[sideRef.current ?? "top"];
        animate(card, { opacity: [0, 1], x: [dx, 0], y: [dy, 0] }, HOVER_IN);
      }
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      if (box) place(box.inlineSize, box.blockSize);
    });
    observer.observe(card);
    let frame = 0;
    const follow = () => {
      frame = 0;
      if (target && !target.isConnected) {
        close(false);
        return;
      }
      place(card.offsetWidth, card.offsetHeight);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(follow);
    };
    followRef.current = follow;
    if (target) {
      window.addEventListener("scroll", schedule, { capture: true, passive: true });
      window.addEventListener("resize", schedule);
    }
    const watch = target && typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (target && watch) watch.observe(document.documentElement);
    return () => {
      followRef.current = null;
      observer.disconnect();
      watch?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  if (!info) return null;
  const tip = info.tip;
  return createPortal(
    <div
      ref={cardRef}
      role="tooltip"
      onPointerEnter={tip ? undefined : () => window.clearTimeout(timerRef.current)}
      onPointerLeave={tip ? undefined : () => (timerRef.current = window.setTimeout(() => close(true), HIDE_DELAY))}
      className={cn(
        "fixed top-0 left-0 z-50 rounded-block border border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)] shadow-e3",
        tip ? "pointer-events-none max-w-[300px] px-3 py-2" : "p-3.5"
      )}
      style={tip ? undefined : { width: CARD_W }}
    >
      {tip ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-[var(--el-ink)]">{tip.title}</p>
          <p className="text-xs text-[var(--el-muted)]">{tip.text}</p>
        </div>
      ) : (
        <HoverBody
          key={`${info.meeting.noteId}:${info.agendas[0].agendaId}:${info.foldOnly ? "fold" : "stop"}`}
          workspaceId={workspaceId}
          info={info}
        />
      )}
    </div>,
    document.body
  );
}

function HoverBody({ workspaceId, info }: { workspaceId: string; info: Extract<HoverInfo, { meeting: MapMeeting }> }) {
  const t = useTranslations("workspace.agendaMap");
  const dateLocale = useDisplayLocale();
  const { meeting, agendas, topicName, fold, foldOnly } = info;
  const [dwelled, setDwelled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDwelled(true), FILL_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const query = useGetMeetingReviewSummary(meeting.noteId, { query: { enabled: dwelled } });
  const summary = okData(query.data);
  const listed = agendas.slice(0, CARD_AGENDAS);
  const hidden = fold.reduce((sum, entry) => sum + entry.count, 0);
  const foldList =
    fold.length > 0 ? (
      <div className={cn("flex flex-col gap-1.5", !foldOnly && "border-t border-[var(--el-hairline)] pt-2")}>
        <p className="text-xs font-semibold text-[var(--el-ink)]">
          {t("foldedBranches", { branches: fold.length, agendas: hidden })}
        </p>
        <ul className="flex flex-col gap-1">
          {fold.slice(0, 4).map((entry, at) => (
            <li key={at} className="flex items-baseline gap-2 text-xs leading-[17px]">
              <span className="shrink-0 text-[var(--el-muted)] tabular-nums">{entry.date}</span>
              <span className="min-w-0 truncate text-[var(--el-ink)]">{entry.title}</span>
              {entry.count > 1 ? (
                <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">{t("more", { count: entry.count - 1 })}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {fold.length > 4 ? <p className="text-xs text-[var(--el-muted)]">{t("moreBranches", { count: fold.length - 4 })}</p> : null}
        <p className="text-xs text-[var(--el-muted)]">
          {foldOnly ? t("expandBranchesClick") : t("expandBranchesPill")}
        </p>
      </div>
    ) : null;
  if (foldOnly)
    return (
      <div className="flex flex-col gap-2.5">
        <p className="flex items-baseline gap-1.5 text-xs text-[var(--el-muted)]">
          <span className="font-semibold whitespace-nowrap text-[var(--el-ink)] tabular-nums">
            {shortMeetingDate(meeting.startedAt)}
          </span>
          <span className="truncate">{t("branchedFrom", { title: agendas[0].title })}</span>
        </p>
        {foldList}
      </div>
    );
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-baseline gap-1.5 text-xs text-[var(--el-muted)]">
        <span className="font-semibold whitespace-nowrap text-[var(--el-ink)] tabular-nums">
          {formatAppDate(meeting.startedAt, { month: "long", day: "numeric", weekday: "short" }, dateLocale)}
        </span>
        <span className="truncate">{meetingHeading(meeting.title)}</span>
      </p>
      <ul className="flex flex-col gap-2">
        {listed.map((agenda) => {
          const line = summary?.agendas.find((item) => item.agendaId === agenda.agendaId)?.summary;
          return (
            <li key={agenda.agendaId} className="flex flex-col gap-0.5">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-[13px] leading-[18px] font-semibold text-[var(--el-ink)]">
                  {agenda.title}
                </span>
                <Badge variant={agenda.completed ? "secondary" : "outline"} className="mt-px">
                  {agenda.completed ? t("completed") : t("notCompleted")}
                </Badge>
              </div>
              {line ? (
                <p className="line-clamp-2 min-h-[34px] text-xs leading-[17px] text-[var(--el-muted)]">{line}</p>
              ) : query.isLoading || !dwelled ? (
                <div className="flex min-h-[34px] flex-col gap-1.5 pt-0.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {agendas.length > CARD_AGENDAS ? (
        <p className="text-xs text-[var(--el-muted)]">{t("moreAgendasHint", { count: agendas.length - CARD_AGENDAS })}</p>
      ) : null}
      {foldList}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--el-hairline)] pt-2">
        {topicName ? (
          <span className="min-w-0 truncate text-xs text-[var(--el-muted)]">{topicName}</span>
        ) : (
          <span />
        )}
        <Link
          href={summaryHref(workspaceId, meeting.noteId, agendas[0].agendaId)}
          className="inline-flex shrink-0 items-center gap-0.5 text-xs text-[var(--el-ink)] underline underline-offset-2"
        >
          {t("viewInNotes")}
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
