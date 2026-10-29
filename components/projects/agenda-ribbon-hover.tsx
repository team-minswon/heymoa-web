"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
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

/** 이 점에 접혀 숨은 갈래의 미리보기: 갈래마다 시작 날짜·첫 안건·안건 수 */
export type FoldPreview = { date: string; title: string; count: number };

export type HoverInfo =
  | {
      rect: DOMRect;
      /** 올려 둔 요소. 스크롤·판 크기 변화로 요소가 옮겨 가면 카드가 따라간다(닫지 않는다) */
      el?: Element;
      topicName: string | null;
      meeting: MapMeeting;
      agendas: MapAgenda[];
      fold: FoldPreview[];
      /** 접힌 갈래 배지에 올렸을 때: 안건 대신 숨은 갈래만 보인다 */
      foldOnly?: boolean;
      tip?: undefined;
    }
  | {
      rect: DOMRect;
      el?: Element;
      /** 열 머리·줄기 이름처럼 안건이 아닌 대상에 붙는 한두 줄 안내. 마우스를 막지 않는다 */
      tip: { title: string; text: string };
    };

export type HoverApi = {
  show: (info: HoverInfo) => void;
  hide: (now?: boolean) => void;
  isOpen: () => boolean;
  /** 대상이 옮겨 갔다: 다음 프레임을 기다리지 않고 바로 대상 곁으로 다시 놓는다 */
  refresh: () => void;
};

const SHOW_DELAY = 150;
const HIDE_DELAY = 140;
/** 열리고 닫힐 때: 4px 밀리며 페이드 */
const SLIDE = 4;
/** 카드가 이만큼(ms) 떠 있으면 그 회의의 요약 한 건만 불러와 채운다. 스치듯 지나가는 호버는 아무것도 부르지 않는다 */
export const FILL_AFTER_MS = 450;
const CARD_W = 304;
const CARD_AGENDAS = 3;
/** 대상과 카드 사이, 카드와 화면 가장자리 사이 */
const GAP = 8;
const MARGIN = 8;

/**
 * 점·캡슐에 마우스를 올리면 150ms 뒤에 뜨는 카드. 안건 제목 · 날짜 · 상태 · 한 줄 요약과 회의록 링크가 든다.
 * 링크를 누를 수 있도록 카드 위로 마우스가 옮겨 가면 닫지 않는다. 점마다 따로 두면 수백 개라 하나만 두고 옮겨 쓴다.
 *
 * 자리: 카드를 그린 직후 한 번 재서 대상을 가리지 않는 쪽 — 위, 아래, 모두 모자라면 옆 — 에 놓고 화면 안으로 보정한다. 쪽은 열릴 때 한 번만
 * 정하고, 그 뒤 대상이 스크롤·재배치로 옮겨 가면 같은 쪽에서 따라간다(눌러서 패널이 열려도 카드는 닫히거나 다시 서지 않는다).
 * 열리고 닫힐 때는 4px 밀리며 옅어진다(`HOVER_IN`·`HOVER_OUT`). 안내(`tip`)는 `pointer-events: none` 이다.
 * 하나만 두고 옮겨 쓰는 카드라, 호버는 이 컴포넌트만 다시 그리고 판은 건드리지 않는다.
 */
export function HoverCard({ workspaceId, ref }: { workspaceId: string; ref: React.Ref<HoverApi> }) {
  const [info, setInfo] = useState<HoverInfo | null>(null);
  const openRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<AnimationPlaybackControls | null>(null);
  /** 카드가 이미 떠 있는 채 다른 대상으로 옮겨 가는 중이면 다시 페이드하지 않는다 */
  const shownRef = useRef(false);
  /** 열릴 때 정한 쪽. 닫히면 비운다 */
  const sideRef = useRef<"top" | "bottom" | "right" | "left" | null>(null);
  /** 열려 있는 카드를 대상 곁으로 다시 놓는 함수 */
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
    // close·cancelExit 은 ref 와 setState 만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // 자리: 카드를 그린 직후 한 번, 카드 크기가 바뀔 때(요약이 도착해 길어질 때)와 대상이 옮겨 갈 때(스크롤·재배치) 다시.
  // 어느 쪽에 놓을지는 열릴 때 한 번만 정한다 — 따라가는 동안 쪽이 바뀌면 카드가 뛴다
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
      // 애니메이션은 다음 프레임부터 돌므로, 그 전에 한 프레임 번쩍이지 않게 시작 값을 먼저 둔다
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
    // 대상이 있는 카드는 스크롤·창 크기·판 크기가 바뀔 때 한 프레임에 한 번 대상을 다시 읽어 따라간다. 대상이 사라지면 닫는다
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
    // close 는 ref 와 setState 만 쓴다
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
          접힌 갈래 {fold.length}개 · 안건 {hidden}개
        </p>
        <ul className="flex flex-col gap-1">
          {fold.slice(0, 4).map((entry, at) => (
            <li key={at} className="flex items-baseline gap-2 text-xs leading-[17px]">
              <span className="shrink-0 text-[var(--el-muted)] tabular-nums">{entry.date}</span>
              <span className="min-w-0 truncate text-[var(--el-ink)]">{entry.title}</span>
              {entry.count > 1 ? (
                <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">외 {entry.count - 1}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {fold.length > 4 ? <p className="text-xs text-[var(--el-muted)]">갈래 {fold.length - 4}개 더</p> : null}
        <p className="text-xs text-[var(--el-muted)]">
          {foldOnly ? "눌러서 갈래를 모두 펼칩니다" : "「+N」을 누르면 갈래를 모두 펼칩니다"}
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
          <span className="truncate">{agendas[0].title}에서 갈라짐</span>
        </p>
        {foldList}
      </div>
    );
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-baseline gap-1.5 text-xs text-[var(--el-muted)]">
        <span className="font-semibold whitespace-nowrap text-[var(--el-ink)] tabular-nums">
          {formatAppDate(meeting.startedAt, { month: "long", day: "numeric", weekday: "short" })}
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
                  {agenda.completed ? "완료" : "미완료"}
                </Badge>
              </div>
              {line ? (
                <p className="line-clamp-2 min-h-[34px] text-xs leading-[17px] text-[var(--el-muted)]">{line}</p>
              ) : query.isLoading || !dwelled ? (
                // 요약이 도착해도 카드 높이가 변하지 않게 두 줄 자리를 잡아 둔다
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
        <p className="text-xs text-[var(--el-muted)]">외 {agendas.length - CARD_AGENDAS}개는 눌러서 봅니다</p>
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
          회의록에서 보기
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
