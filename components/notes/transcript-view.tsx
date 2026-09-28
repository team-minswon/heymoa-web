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
import { TranscriptGapRow } from "@/components/notes/transcript-gap-row";
import { SpeakerChip } from "@/components/notes/speaker-chip";
import { CopyMarkdownButton } from "@/components/notes/copy-markdown-button";
import { transcriptToMarkdown, type NoteMeta } from "@/lib/notes/copy-markdown";
import { toGapRows } from "@/lib/transcription/gaps";
import {
  createSpeakerIdentityResolver,
  type SpeakerFace,
} from "@/lib/transcription/speaker-identity";
import {
  formatOffset,
  interleaveTranscript,
  mergeLiveSegments,
  selectLivePartial,
} from "@/lib/transcription/presentation";
import type { MeetingPhase } from "@/lib/notes/meeting-state";
import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import {
  useTranscriptFocus,
  type TranscriptFocus,
} from "@/components/notes/use-transcript-focus";
import { prefersReducedMotion } from "@/lib/utils";

const FOLLOW_THRESHOLD_PX = 180;

/** 발화 길이는 고르지 않다 — 전부 같은 폭이면 표처럼 보여서 대화로 안 읽힌다. */
const TRANSCRIPT_SKELETON_WIDTHS = ["58%", "86%", "41%"];

function getDistanceFromBottom(viewport: HTMLElement) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
}

export function TranscriptView({
  noteId,
  phase,
  participants = [],
  noteMeta,
  focusSegmentId,
  onFocusHandled,
}: {
  noteId: string;
  phase: MeetingPhase;
  /** 화자에 붙은 사람의 얼굴. 계약의 `speakers[]` 에는 사진이 없다. */
  participants?: SpeakerFace[];
  /** 복사본 머리말. 셸이 읽어 내린다 — 여기서 노트를 다시 구독하지 않는다. */
  noteMeta?: NoteMeta | null;
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
      refetchOnWindowFocus: true,
    },
  });
  const transcript =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data
      : null;
  const persisted = useMemo(() => transcript?.segments ?? [], [transcript]);
  const segments = useMemo(
    () =>
      mergeLiveSegments(
        persisted,
        liveForNote ? liveTranscript.finalSegments : [],
        noteRealtime.transcript.finalSegments
      ),
    [
      liveForNote,
      liveTranscript.finalSegments,
      noteRealtime.transcript.finalSegments,
      persisted,
    ]
  );
  const rows = useMemo(
    () =>
      interleaveTranscript(
        segments,
        toGapRows(transcript?.gaps ?? [], transcript?.transcriptGaps)
      ),
    [segments, transcript]
  );
  const diarized = transcript?.diarization?.status === "MAPPED";
  const speakerOf = useMemo(
    () =>
      createSpeakerIdentityResolver(
        diarized ? transcript!.diarization.speakers : [],
        participants
      ),
    [diarized, transcript, participants]
  );

  const { partial: ownPartial, finalSegments: ownFinals } = liveTranscript;
  const { partial: topicPartial, finalSegments: topicFinals } =
    noteRealtime.transcript;
  const partial = useMemo(
    () =>
      selectLivePartial({
        recordingHere: liveForNote,
        phase: recording.phase,
        own: { partial: ownPartial, finalSegments: ownFinals },
        topic: { partial: topicPartial, finalSegments: topicFinals },
      }),
    [
      liveForNote,
      ownFinals,
      ownPartial,
      recording.phase,
      topicFinals,
      topicPartial,
    ]
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
  /**
   * 키에 텍스트도 넣는다. 서버는 같은 `segmentId` 로 교정본을 다시 보내고 재연결 재조회도 같은
   * 행의 문장을 바꾼다. 그때 행 높이는 자라는데 scroll 이벤트는 안 나서, id 만 보면 추종 중인
   * 독자가 바닥에서 밀린 채로 남는다.
   */
  const lastSegment = segments.at(-1);
  const liveContentKey = `${lastSegment?.segmentId ?? ""}:${lastSegment?.text ?? ""}:${partial?.confirmedText ?? ""}:${partial?.pendingText ?? ""}`;

  const updateFollowing = useCallback((next: boolean) => {
    followingRef.current = next;
    setIsFollowing(next);
  }, []);

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const nextBehavior = prefersReducedMotion() ? "auto" : behavior;

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
   * 위 자동 스크롤 뒤에 부른다. 진행 중 회의는 같은 커밋에서 바닥으로 한 프레임 내리는데,
   * 이 훅도 rAF로 움직이므로 나중에 등록된 쪽이 남는다. 옮겨 간 뒤에는 scroll 핸들러가
   * 바닥과의 거리를 다시 재 추종을 끄고, 사용자가 맨 아래로 돌아가면 그대로 되살아난다.
   */
  const { segmentRef, isHighlighted, markProps } = useTranscriptFocus(
    segments,
    {
      focusSegmentId,
      onFocusHandled,
    }
  );

  // 여기 스크롤 엔진은 챗봇과 다르다(프로그램 스크롤 가드·라이브 판정). 생김새만 공유한다.
  //
  // 버튼은 회의 상태가 아니라 스크롤 위치로 띄운다. 종료된 회의의 전사를 올려 읽어도
  // 바닥으로 돌아갈 수 있어야 한다.
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
        {/* 조회가 실패했으면 복사를 세우지 않는다. 실시간으로 들어온 줄만으로 `rows` 가 차
            있어서, 복사하면 앞부분이 빠진 회의록이 남는다. */}
        {noteMeta && rows.length && !transcriptQuery.isError ? (
          <div className="sticky top-0 z-10 -mt-5 flex justify-end bg-white pb-2 pt-5">
            <CopyMarkdownButton
              label="스크립트"
              // 중지 뒤 최종 재조회가 도는 동안은 무엇이 최종본인지 모른다.
              disabled={transcriptQuery.isFetching}
              build={() =>
                transcriptToMarkdown({
                  note: {
                    ...noteMeta,
                    durationMs: transcript?.recording?.durationMs ?? 0,
                  },
                  // 관전자가 종료 안내에서 안 넘어가면 종료된 회의도 여기 남는다 —
                  // 아카이브와 같은 봉인 상태를 말해야 한다.
                  truncated: transcript?.recording?.seal === "TRUNCATED",
                  // `rows` 는 확정된 줄만 담는다. 받아 적는 중인 글자는 복사본에 안 넣는다.
                  rows,
                  speakerNameOf: (label) =>
                    diarized ? (speakerOf(label)?.displayName ?? null) : null,
                })
              }
            />
          </div>
        ) : null}
        <section
          role={transcriptQuery.isPending ? undefined : "log"}
          aria-label="회의 스크립트"
        >
          {transcriptQuery.isPending ? (
            /* 실제 행과 같은 격자·여백이라 도착해도 모양이 안 바뀐다. */
            <div aria-label="대화 기록 불러오는 중">
              {TRANSCRIPT_SKELETON_WIDTHS.map((width, row) => (
                <div
                  key={row}
                  className="grid grid-cols-1 gap-2 border-b border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
                >
                  <Skeleton className="mt-1 h-3 w-10 rounded-chip sm:w-32" />
                  {/* 발화 한 줄(leading-7, 28px) 안에 막대를 놓는다. 막대 높이만 맞추면 행이 낮아진다. */}
                  <div className="flex h-7 items-center">
                    <Skeleton className="h-4 rounded-chip" style={{ width }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {rows.map((row) =>
                row.type === "gap" ? (
                  <TranscriptGapRow key={row.gap.gapId} row={row.gap} />
                ) : (
                  <article
                    key={row.segment.segmentId}
                    ref={segmentRef(row.segment.segmentId)}
                    /* 짚힌 줄로 포커스를 옮길 수 있게 늘 단다. 짚힌 줄에만 달면 형광이 꺼질 때
                       속성이 사라지며 포커스를 빼앗는다. `-1` 은 Tab 순서에 안 든다. */
                    tabIndex={-1}
                    data-testid="transcript-block"
                    data-timeline-start-ms={row.segment.startedAtMs}
                    data-state="final"
                    data-focused={
                      isHighlighted(row.segment.segmentId) || undefined
                    }
                    className="group grid grid-cols-1 gap-2 border-b border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
                  >
                    <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-ink)] sm:w-32">
                      {formatOffset(row.segment.startedAtMs)}
                    </time>
                    <div className="min-w-0">
                      {speakerOf(row.segment.speakerLabel) ? (
                        <SpeakerChip
                          identity={speakerOf(row.segment.speakerLabel)!}
                          className="mb-1"
                        />
                      ) : null}
                      <p className="whitespace-normal break-keep text-read leading-7 tracking-[0.005em] text-[var(--el-ink)]">
                        <span {...markProps(row.segment.segmentId)}>
                          {row.segment.text}
                        </span>
                      </p>
                    </div>
                  </article>
                )
              )}

              {partial ? (
                <article
                  data-state="partial"
                  aria-live="polite"
                  aria-atomic="true"
                  /* 안쪽 여백만큼 `-mx-4` 로 끌어내 본문 x 좌표를 확정 행과 맞춘다. 확정되는
                     순간 글자가 옆으로 튀지 않는다. */
                  className="-mx-4 mt-2 grid grid-cols-1 gap-2 rounded-chip bg-[var(--el-canvas-soft)] px-4 py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
                >
                  {/* 확정 행의 시각 열과 같은 크기·색이다. 살아 있다는 신호는 점이 한다. */}
                  <span className="flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap pt-1 text-[11px] text-[var(--el-muted)] sm:w-32">
                    <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                    받아 적는 중
                  </span>
                  {/* 업체가 확정한 앞부분은 다시 안 바뀌므로 확정 행과 같은 농도로, 다음
                      snapshot 이 갈아치울 뒷부분만 옅게 둔다. */}
                  <p className="min-w-0 whitespace-normal break-keep text-read leading-7 text-[var(--el-body)]">
                    {partial.confirmedText ? (
                      <span
                        data-testid="partial-confirmed"
                        className="text-[var(--el-ink)]"
                      >
                        {partial.confirmedText}
                      </span>
                    ) : null}
                    {partial.pendingText ? (
                      <span data-testid="partial-pending">
                        {partial.pendingText}
                      </span>
                    ) : null}
                    <span className="ml-1 inline-block h-4 w-px animate-pulse bg-[var(--el-muted)] align-middle" />
                  </p>
                </article>
              ) : null}

              {!segments.length && !viewerLive && phase === "not-started" ? (
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

              {!segments.length && viewerLive && !partial ? (
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

              {!segments.length && !viewerLive && phase !== "not-started" ? (
                <p className="py-8 text-sm text-[var(--el-muted)]">
                  스크립트가 없습니다.
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}
