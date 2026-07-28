"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  useRecording,
  useRecordingTranscript,
} from "@/components/transcription/recording-provider";
import { ScrollToBottomButton } from "@/components/heymoa/scroll-to-bottom-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";
import {
  groupTranscriptSegments,
  type TranscriptPresentationSegment,
} from "@/lib/transcription/presentation";
import type { SharedChatPhase } from "@/lib/notes/meeting-state";

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

export function TranscriptView({
  noteId,
  phase,
}: {
  noteId: string;
  phase: SharedChatPhase;
}) {
  const recording = useRecording();
  const liveTranscript = useRecordingTranscript();
  const liveForNote =
    (recording.activeNoteId ?? recording.session?.noteId) === noteId;
  const serverActive = phase === "active";
  const viewerLive = serverActive || liveForNote;
  const transcriptQuery = useGetNoteTranscript(noteId, {
    query: {
      staleTime: serverActive ? 0 : 60_000,
      refetchInterval: serverActive ? 2_500 : false,
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
    if (!serverActive || transcriptQuery.isPending) return;
    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [scrollToLatest, serverActive, transcriptQuery.isPending]);

  useEffect(() => {
    if (
      transcriptQuery.isPending ||
      !viewerLive ||
      !followingRef.current
    )
      return;
    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [
    liveContentKey,
    scrollToLatest,
    transcriptQuery.isPending,
    viewerLive,
  ]);

  useEffect(
    () => () => {
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
    },
    []
  );

  // 여기 스크롤 엔진은 챗봇과 다르다(프로그램 스크롤 가드·라이브 판정). 생김새만 공유한다.
  //
  // **`active`를 보지 않는다.** 스크롤 추적은 회의 상태와 무관하게 도는데 버튼 표시만
  // 라이브에 묶여 있어서, 종료된 회의의 전사를 위로 올려 읽으면 바닥으로 돌아갈 방법이
  // 없었다(APP-239). 되돌아갈 곳이 있는지는 회의가 도는지가 아니라 스크롤 위치가 정한다.
  const followAction = !isFollowing ? (
    <ScrollToBottomButton
      label="맨 아래로"
      onClick={() => scrollToLatest("smooth")}
      // 레코더 독이 하단 중앙에 떠 있어 그 위로 올린다.
      className="bottom-20"
    />
  ) : null;

  return (
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      overlay={followAction}
    >
      <div className="mx-auto w-full max-w-[820px] px-5 pb-28 pt-7 sm:px-9 sm:pt-9">
        {/* v5: 제품 면 대문자 키커·세리프 헤더 제거 — 탭이 이미 위치를 말한다(FORM SPEC).
            녹음 상태는 상단바·레코더 독이 표시한다. 전사 행이 바로 시작한다. */}
        <section
          role={transcriptQuery.isPending ? undefined : "log"}
          aria-label="회의 전사"
        >
          {transcriptQuery.isPending ? (
            <div className="space-y-4" aria-label="대화 기록 불러오는 중">
              <Skeleton className="h-24 rounded-block" />
              <Skeleton className="h-28 rounded-block" />
            </div>
          ) : (
            <div>
              {blocks.map((block) => (
                <article
                  key={block.blockId}
                  data-testid="transcript-block"
                  data-segment-count={block.segmentIds.length}
                  data-timeline-start-ms={block.timelineStartedAtMs}
                  data-state="final"
                  className="group grid grid-cols-[64px_1fr] gap-5 border-b border-[var(--el-hairline)] py-4"
                >
                  <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-ink)]">
                    {formatOffset(block.timelineStartedAtMs)}
                  </time>
                  <p className="text-read leading-7 tracking-[0.005em] text-[var(--el-ink)]">
                    {block.text}
                  </p>
                </article>
              ))}

              {partialText ? (
                <article
                  data-state="partial"
                  aria-live="polite"
                  aria-atomic="true"
                  className="mt-2 grid grid-cols-[64px_1fr] gap-5 rounded-chip bg-[var(--el-canvas-soft)] px-3 py-4"
                >
                  <span className="flex items-center gap-1.5 self-start pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-600">
                    <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                    Live
                  </span>
                  <p className="text-read leading-7 text-[var(--el-body)]">
                    {partialText}
                    <span className="ml-1 inline-block h-4 w-px animate-pulse bg-[var(--el-muted)] align-middle" />
                  </p>
                </article>
              ) : null}

              {!blocks.length && !viewerLive && phase === "not-started" ? (
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

              {!blocks.length && viewerLive && !partialText ? (
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

              {!blocks.length && !viewerLive && phase !== "not-started" ? (
                <p className="py-8 text-sm text-[var(--el-muted)]">
                  전사된 대화가 없습니다.
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}
