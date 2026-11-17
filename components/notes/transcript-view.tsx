"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { TranscriptRow } from "@/components/notes/transcript-row";
import { CopyMarkdownButton } from "@/components/notes/copy-markdown-button";
import { useSpeakerFallbackNames } from "@/components/notes/speaker-chip";
import { transcriptToMarkdown, type NoteMeta } from "@/lib/notes/copy-markdown";
import { toGapRows } from "@/lib/transcription/gaps";
import {
  createSpeakerIdentityResolver,
  type SpeakerFace,
} from "@/lib/transcription/speaker-identity";
import {
  interleaveTranscript,
  mergeLiveSegments,
} from "@/lib/transcription/presentation";
import { meetingLengthOf, type MeetingPhase } from "@/lib/notes/meeting-state";
import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import { useLivePartial } from "@/components/notes/use-live-partial";
import {
  useTranscriptFocus,
  type TranscriptFocus,
} from "@/components/notes/use-transcript-focus";
import { prefersReducedMotion } from "@/lib/utils";
import {
  distanceFromBottom,
  nextFollowing,
  watchUpwardInput,
} from "@/lib/notes/follow-scroll";

const EMPTY_PARTICIPANTS: SpeakerFace[] = [];
const EMPTY_SPEAKERS: never[] = [];

const TRANSCRIPT_SKELETON_WIDTHS = ["58%", "86%", "41%"];

export function TranscriptView({
  noteId,
  phase,
  participants = EMPTY_PARTICIPANTS,
  noteMeta,
  focusSegmentId,
  onFocusHandled,
}: {
  noteId: string;
  phase: MeetingPhase;
  participants?: SpeakerFace[];
  noteMeta?: NoteMeta | null;
} & TranscriptFocus) {
  const t = useTranslations("notes.transcript");
  const tActions = useTranslations("common.actions");
  const fallbackNames = useSpeakerFallbackNames();
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
  const speakers = diarized ? transcript!.diarization.speakers : EMPTY_SPEAKERS;
  const speakerOf = useMemo(
    () =>
      createSpeakerIdentityResolver(
        speakers,
        participants,
        fallbackNames.speaker
      ),
    [speakers, participants, fallbackNames]
  );

  const partial = useLivePartial(noteId);
  const isTranscriptError = transcriptQuery.isError;
  const refetchTranscript = transcriptQuery.refetch;

  useEffect(() => {
    if (!isTranscriptError) return;

    toast.error(t("loadFailed"), {
      id: `transcript-load-${noteId}`,
      action: {
        label: tActions("retry"),
        onClick: () => void refetchTranscript(),
      },
    });
  }, [isTranscriptError, noteId, refetchTranscript, t, tActions]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  /** 키에 텍스트도 넣는다. 서버가 같은 `segmentId` 로 교정본을 다시 보내면 행 높이는 자라는데 scroll 이벤트는 안 난다. */
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

    let previousTop: number | null = null;
    const handleScroll = () => {
      const top = viewport.scrollTop;
      const previous = previousTop;
      previousTop = top;
      if (programmaticScrollRef.current) return;
      updateFollowing(
        nextFollowing({
          following: followingRef.current,
          top,
          previousTop: previous,
          distance: distanceFromBottom(viewport),
        })
      );
    };
    const stopWatching = watchUpwardInput(viewport, () => {
      if (!followingRef.current) return;
      programmaticScrollRef.current = false;
      updateFollowing(false);
    });

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    // 탭이 숨긴 동안(`display:none`)의 바닥 이동은 무시되고, 다시 보이면 숨기기 전 위치로
    // 되살아난다. 따라가던 사람이 그 사이 붙은 발화를 놓치지 않게 보이는 순간 바닥에 맞춘다.
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (followingRef.current && viewport.clientHeight > 0)
              scrollToLatest("auto");
          });
    observer?.observe(viewport);

    return () => {
      stopWatching();
      viewport.removeEventListener("scroll", handleScroll);
      observer?.disconnect();
    };
  }, [scrollToLatest, updateFollowing]);

  useEffect(() => {
    if (!serverActive || transcriptQuery.isPending) return;
    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [scrollToLatest, serverActive, transcriptQuery.isPending]);

  useEffect(() => {
    if (transcriptQuery.isPending || !viewerLive || !followingRef.current)
      return;
    const frame = window.requestAnimationFrame(() => {
      if (followingRef.current) scrollToLatest("auto");
    });
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

  const { segmentRef, isHighlighted, markProps } = useTranscriptFocus(
    segments,
    {
      focusSegmentId,
      onFocusHandled,
    }
  );

  const confirmedRows = useMemo(
    () =>
      rows.map((row) =>
        row.type === "gap" ? (
          <TranscriptGapRow key={row.gap.gapId} row={row.gap} />
        ) : (
          <TranscriptRow
            key={row.segment.segmentId}
            segment={row.segment}
            speaker={speakerOf(row.segment.speakerLabel)}
            focus={
              isHighlighted(row.segment.segmentId)
                ? {
                    ref: segmentRef(row.segment.segmentId),
                    markProps: markProps(row.segment.segmentId),
                  }
                : null
            }
          />
        )
      ),
    [rows, speakerOf, segmentRef, isHighlighted, markProps]
  );

  const followAction = !isFollowing ? (
    <ScrollToBottomButton
      label={t("scrollToBottom")}
      onClick={() => scrollToLatest("smooth")}
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
        {noteMeta && rows.length && !transcriptQuery.isError ? (
          <div className="sticky top-0 z-10 -mt-5 flex justify-end bg-white pb-2 pt-5">
            <CopyMarkdownButton
              kind="transcript"
              disabled={transcriptQuery.isFetching}
              build={(doc) =>
                transcriptToMarkdown({
                  doc,
                  note: {
                    ...noteMeta,
                    durationMs: meetingLengthOf(
                      transcript?.recording?.durationMs,
                      transcript
                    ),
                  },
                  truncated: transcript?.recording?.seal === "TRUNCATED",
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
          aria-label={t("label")}
        >
          {transcriptQuery.isPending ? (
            <div aria-label={t("loading")}>
              {TRANSCRIPT_SKELETON_WIDTHS.map((width, row) => (
                <div
                  key={row}
                  className="grid grid-cols-1 gap-2 border-b border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
                >
                  <Skeleton className="mt-1 h-3 w-10 rounded-chip sm:w-32" />
                  <div className="flex h-7 items-center">
                    <Skeleton className="h-4 rounded-chip" style={{ width }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {confirmedRows}

              {partial ? (
                <article
                  data-state="partial"
                  aria-live="polite"
                  aria-atomic="true"
                  className="-mx-4 mt-2 grid grid-cols-1 gap-2 rounded-chip bg-[var(--el-canvas-soft)] px-4 py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
                >
                  <span className="flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap pt-1 text-[11px] text-[var(--el-muted)] sm:w-32">
                    <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                    {t("transcribing")}
                  </span>
                  <p className="min-w-0 whitespace-normal text-read leading-7 text-[var(--el-body)]">
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
                    className="text-7xl leading-none text-[var(--el-hairline-strong)]"
                  >
                    “
                  </span>
                  <h2 className="mt-2 max-w-md text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
                    {t("notStarted.title")}
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-[var(--el-muted)]">
                    {t("notStarted.body")}
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
                    {t("waiting.title")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--el-muted)]">
                    {t("waiting.body")}
                  </p>
                </div>
              ) : null}

              {!segments.length && !viewerLive && phase !== "not-started" ? (
                <p className="py-8 text-sm text-[var(--el-muted)]">
                  {t("empty")}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}
