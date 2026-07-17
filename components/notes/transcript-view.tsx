"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";

import {
  useRecording,
  useRecordingTranscript,
} from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";
import {
  groupTranscriptSegments,
  type TranscriptPresentationSegment,
} from "@/lib/transcription/presentation";

const FOLLOW_THRESHOLD_PX = 180;

function formatOffset(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

function getDistanceFromBottom(viewport: HTMLElement) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
}

export function TranscriptView({ noteId }: { noteId: string }) {
  const recording = useRecording();
  const liveTranscript = useRecordingTranscript();
  const liveForNote =
    (recording.activeNoteId ?? recording.session?.noteId) === noteId;
  const active = Boolean(
    liveForNote &&
    ["requesting-permission", "connecting", "recording", "stopping"].includes(
      recording.phase
    )
  );
  const transcriptQuery = useGetNoteTranscript(noteId, {
    query: {
      staleTime: active ? 0 : 60_000,
      refetchInterval: active ? 2_500 : false,
      refetchOnWindowFocus: true,
    },
  });
  const persisted = useMemo(
    () =>
      transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
        ? (transcriptQuery.data.data.data.segments ?? [])
        : [],
    [transcriptQuery.data]
  );
  const blocks = useMemo(() => {
    const rows = new Map<string, TranscriptPresentationSegment>();

    persisted.forEach((segment) => rows.set(segment.segmentId, segment));
    if (liveForNote) {
      liveTranscript.finalSegments.forEach((segment) => {
        rows.set(segment.segmentId, {
          ...segment,
          transcriptionSessionId: recording.session?.sessionId,
        });
      });
    }

    // The API already orders sessions chronologically. Grouping is presentation
    // only: persisted segment identity and session boundaries stay intact.
    return groupTranscriptSegments([...rows.values()]);
  }, [
    liveForNote,
    liveTranscript.finalSegments,
    persisted,
    recording.session?.sessionId,
  ]);
  const partialText = useMemo(
    () =>
      liveForNote
        ? Object.values(liveTranscript.partialByUtteranceId)
            .map((text) => text.trim())
            .filter(Boolean)
            .join(" ")
        : "",
    [liveForNote, liveTranscript.partialByUtteranceId]
  );
  const isTranscriptError = transcriptQuery.isError;
  const refetchTranscript = transcriptQuery.refetch;

  useEffect(() => {
    if (!isTranscriptError) return;

    toast.error("대화 기록을 불러오지 못했습니다.", {
      id: `transcript-load-${noteId}`,
      action: {
        label: "다시 시도",
        onClick: () => void refetchTranscript(),
      },
    });
  }, [isTranscriptError, noteId, refetchTranscript]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const liveContentKey = `${blocks.at(-1)?.blockId ?? ""}:${blocks.at(-1)?.text ?? ""}:${partialText}`;

  const updateFollowing = useCallback((next: boolean) => {
    followingRef.current = next;
    setIsFollowing(next);
  }, []);

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const nextBehavior = prefersReducedMotion ? "auto" : behavior;

      updateFollowing(true);
      if (nextBehavior === "smooth") {
        programmaticScrollRef.current = true;
        if (programmaticScrollTimerRef.current !== null) {
          window.clearTimeout(programmaticScrollTimerRef.current);
        }
        programmaticScrollTimerRef.current = window.setTimeout(() => {
          programmaticScrollRef.current = false;
          programmaticScrollTimerRef.current = null;
        }, 500);
      }

      if (typeof viewport.scrollTo === "function") {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: nextBehavior,
        });
      } else {
        viewport.scrollTop = viewport.scrollHeight;
      }
    },
    [updateFollowing]
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      if (programmaticScrollRef.current) return;
      updateFollowing(getDistanceFromBottom(viewport) <= FOLLOW_THRESHOLD_PX);
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [updateFollowing]);

  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [active, scrollToLatest]);

  useEffect(() => {
    if (!liveForNote || !followingRef.current) return;
    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [liveContentKey, liveForNote, scrollToLatest]);

  useEffect(
    () => () => {
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
    },
    []
  );

  const statusLabel =
    recording.phase === "requesting-permission"
      ? "마이크 권한 확인 중"
      : recording.phase === "connecting"
        ? "실시간 전사 연결 중"
        : recording.phase === "stopping"
          ? "마지막 문장 정리 중"
          : "실시간 기록 중";
  const followAction =
    active && !isFollowing ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-events-auto h-9 rounded-full bg-white/95 px-3.5 shadow-[0_8px_24px_rgba(28,25,23,0.10)] backdrop-blur-xl"
          onClick={() => scrollToLatest("smooth")}
        >
          <ArrowDown className="size-3.5" />
          최신 기록 보기
        </Button>
      </div>
    ) : null;

  return (
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      overlay={followAction}
    >
      <div className="mx-auto w-full max-w-[820px] px-5 pb-28 pt-7 sm:px-9 sm:pt-9">
        <section aria-label="회의 전사">
          <header className="border-b border-[var(--el-hairline-strong)] pb-4">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--el-muted)]">
              {active ? (
                <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
              ) : null}
              {active ? statusLabel : "Conversation"}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
              {active ? "대화를 기록하고 있습니다" : "대화 기록"}
            </h2>
          </header>

          {transcriptQuery.isPending ? (
            <div className="mt-6 space-y-4" aria-label="대화 기록 불러오는 중">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : (
            <div className="mt-3">
              {blocks.map((block) => (
                <article
                  key={block.blockId}
                  data-testid="transcript-block"
                  data-segment-count={block.segmentIds.length}
                  data-timeline-start-ms={block.timelineStartedAtMs}
                  data-state="final"
                  className="group grid grid-cols-[58px_1fr] gap-4 border-b border-[var(--el-hairline)] py-5 sm:grid-cols-[66px_1fr] sm:gap-6"
                >
                  <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-ink)]">
                    {formatOffset(block.timelineStartedAtMs)}
                  </time>
                  <p className="max-w-3xl text-[15px] leading-7 tracking-[0.005em] text-[var(--el-ink)]">
                    {block.text}
                  </p>
                </article>
              ))}

              {partialText ? (
                <article
                  data-state="partial"
                  aria-live="polite"
                  aria-atomic="true"
                  className="mt-2 grid grid-cols-[58px_1fr] gap-4 rounded-xl bg-[var(--el-canvas-soft)] px-3 py-4 sm:grid-cols-[66px_1fr] sm:gap-6"
                >
                  <span className="flex items-center gap-1.5 self-start pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-600">
                    <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                    Live
                  </span>
                  <p className="max-w-3xl text-[15px] leading-7 text-[var(--el-body)]">
                    {partialText}
                    <span className="ml-1 inline-block h-4 w-px animate-pulse bg-[var(--el-muted)] align-middle" />
                  </p>
                </article>
              ) : null}

              {!blocks.length && !active ? (
                <div className="flex min-h-72 flex-col justify-center border-b border-[var(--el-hairline)] py-12">
                  <span
                    aria-hidden
                    className="font-serif text-7xl leading-none text-[var(--el-hairline-strong)]"
                  >
                    “
                  </span>
                  <h2 className="mt-2 max-w-md font-serif text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
                    첫 대화가 이곳에 기록됩니다.
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-[var(--el-muted)]">
                    기록을 시작하고 평소처럼 대화하세요. 자연스러운 문단으로
                    정리해 보여드립니다.
                  </p>
                </div>
              ) : null}

              {!blocks.length && active && !partialText ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <span className="flex items-end gap-1" aria-hidden>
                    {[0.35, 0.7, 1, 0.55, 0.3].map((height, index) => (
                      <span
                        key={index}
                        className="h-8 w-1 origin-bottom animate-pulse rounded-full bg-[var(--el-ink)]"
                        style={{
                          transform: `scaleY(${height})`,
                          animationDelay: `${index * 90}ms`,
                        }}
                      />
                    ))}
                  </span>
                  <p className="mt-5 text-sm font-medium text-[var(--el-ink)]">
                    첫 발화를 기다리고 있습니다
                  </p>
                  <p className="mt-1 text-xs text-[var(--el-muted)]">
                    자연스럽게 말씀해 주세요.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}
