"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/ui/toast";

import {
  useRecording,
  useRecordingTranscript,
} from "@/components/transcription/recording-provider";
import { ScrollToBottomButton } from "@/components/heymoa/scroll-to-bottom-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";
import {
  formatOffset,
  groupTranscriptSegments,
  type TranscriptPresentationSegment,
} from "@/lib/transcription/presentation";
import type { SharedChatPhase } from "@/lib/notes/meeting-state";
import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import {
  FOCUSED_TEXT_CLASS,
  useTranscriptFocus,
  type TranscriptFocus,
} from "@/components/notes/use-transcript-focus";
import { cn } from "@/lib/utils";

const FOLLOW_THRESHOLD_PX = 180;

function getDistanceFromBottom(viewport: HTMLElement) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
}

export function TranscriptView({
  noteId,
  phase,
  focusSegmentId,
  onFocusHandled,
}: {
  noteId: string;
  phase: SharedChatPhase;
} & TranscriptFocus) {
  const recording = useRecording();
  const liveTranscript = useRecordingTranscript();
  const noteRealtime = useNoteRealtime();
  const liveForNote =
    (recording.activeNoteId ?? recording.session?.noteId) === noteId;
  const serverActive = phase === "active";
  const viewerLive = serverActive || liveForNote;
  const transcriptQuery = useGetNoteTranscript(noteId, {
    query: {
      staleTime: serverActive ? 0 : 60_000,
      refetchInterval: serverActive ? 30_000 : false,
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
    noteRealtime.transcript.finalSegments.forEach((segment) => {
      rows.set(segment.segmentId, segment);
    });
    if (liveForNote) {
      liveTranscript.finalSegments.forEach((segment) => {
        rows.set(segment.segmentId, segment);
      });
    }

    // The API already orders sessions chronologically. Grouping is presentation
    // only: persisted segment identity and session boundaries stay intact.
    return groupTranscriptSegments([...rows.values()]);
  }, [
    liveForNote,
    liveTranscript.finalSegments,
    noteRealtime.transcript.finalSegments,
    persisted,
  ]);
  const partialText = useMemo(() => {
    // 살아 있는 partial은 세션당 하나다. 이어 붙이지 않는 것이 핵심이다 — 합치면 확정되지
    // 못한 발화가 화면에 계속 남는다.
    //
    // 소스는 둘인데 같은 서버 이벤트에서 갈라진다. **내가 지금 녹음 중일 때만** 내 전사
    // 소켓이 원본이고 노트 토픽은 그 메아리다. `liveForNote`만으로 가르면 안 된다 —
    // 녹음이 끝나도 `activeNoteId`는 disconnect 전까지 남아서, 다른 탭·기기가 회의를
    // 재개했을 때 비어 있는 내 소켓이 토픽을 가린다.
    //
    // utteranceId 순서로 "더 최신"을 고르지 않는다 — 서버가 재연결 때 이전 id를
    // 되살리므로(`rollbackDiscardedCommit`) id 대소는 최신성을 뜻하지 않는다.
    // `stopping`도 포함한다 — 중지 요청 뒤에도 같은 소켓이 마지막 final을 drain하는 동안
    // 로컬 partial이 살아 있다. 여기서 토픽으로 넘기면 그 구간이 화면에서 빈다.
    const ownSocketIsSource =
      liveForNote &&
      (recording.phase === "recording" || recording.phase === "stopping");
    const live = ownSocketIsSource
      ? liveTranscript.partial
      : noteRealtime.transcript.partial;
    if (!live) return "";
    const confirmed =
      noteRealtime.transcript.finalSegments.some(
        (segment) => segment.utteranceId === live.utteranceId
      ) ||
      (liveForNote &&
        liveTranscript.finalSegments.some(
          (segment) => segment.utteranceId === live.utteranceId
        ));
    return confirmed ? "" : live.text.trim();
  }, [
    liveForNote,
    liveTranscript.finalSegments,
    liveTranscript.partial,
    noteRealtime.transcript.finalSegments,
    noteRealtime.transcript.partial,
    recording.phase,
  ]);
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
    if (transcriptQuery.isPending || !viewerLive || !followingRef.current)
      return;
    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [liveContentKey, scrollToLatest, transcriptQuery.isPending, viewerLive]);

  useEffect(
    () => () => {
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
    },
    []
  );

  /**
   * **위 자동 스크롤 뒤에 부른다.** 진행 중 회의는 같은 커밋에서 바닥으로 한 프레임 내리는데,
   * 이 훅도 rAF로 움직이므로 나중에 등록된 쪽이 남는다. 옮겨 간 뒤에는 scroll 핸들러가
   * 바닥과의 거리를 다시 재 추종을 끄고, 사용자가 맨 아래로 돌아가면 그대로 되살아난다.
   */
  const { blockRef, isHighlighted } = useTranscriptFocus(blocks, {
    focusSegmentId,
    onFocusHandled,
  });

  // 여기 스크롤 엔진은 챗봇과 다르다(프로그램 스크롤 가드·라이브 판정). 생김새만 공유한다.
  //
  // **`active`를 보지 않는다.** 스크롤 추적은 회의 상태와 무관하게 도는데 버튼 표시만
  // 라이브에 묶여 있어서, 종료된 회의의 전사를 위로 올려 읽으면 바닥으로 돌아갈 방법이
  // 없었다(APP-239). 되돌아갈 곳이 있는지는 회의가 도는지가 아니라 스크롤 위치가 정한다.
  const followAction = !isFollowing ? (
    <ScrollToBottomButton
      label="맨 아래로"
      onClick={() => scrollToLatest("smooth")}
      // desktop에서는 레코더 독이 하단 중앙에 떠 있어 그 위로 올린다.
      className="lg:bottom-20"
    />
  ) : null;

  return (
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      overlay={followAction}
    >
      <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pb-7 pt-5 sm:pb-9 lg:pb-28">
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
                  ref={blockRef(block.blockId)}
                  data-testid="transcript-block"
                  data-segment-count={block.segmentIds.length}
                  data-timeline-start-ms={block.timelineStartedAtMs}
                  data-state="final"
                  data-focused={isHighlighted(block.blockId) || undefined}
                  className="group grid grid-cols-1 gap-2 border-b border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
                >
                  <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-ink)] sm:w-32">
                    {formatOffset(block.timelineStartedAtMs)}
                  </time>
                  <p className="min-w-0 whitespace-normal break-keep text-read leading-7 tracking-[0.005em] text-[var(--el-ink)]">
                    <span
                      className={cn(
                        isHighlighted(block.blockId) && FOCUSED_TEXT_CLASS
                      )}
                    >
                      {block.text}
                    </span>
                  </p>
                </article>
              ))}

              {partialText ? (
                <article
                  data-state="partial"
                  aria-live="polite"
                  aria-atomic="true"
                  className="mt-2 grid grid-cols-1 gap-2 rounded-chip bg-[var(--el-canvas-soft)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
                >
                  <span className="flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-600 sm:w-32">
                    <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                    실시간 · 확정 전
                  </span>
                  <p className="min-w-0 whitespace-normal break-keep text-read leading-7 text-[var(--el-body)]">
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
