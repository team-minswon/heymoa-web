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
  type TranscriptPresentationSegment,
} from "@/lib/transcription/presentation";
import type { MeetingPhase } from "@/lib/notes/meeting-state";
import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import {
  useTranscriptFocus,
  type TranscriptFocus,
} from "@/components/notes/use-transcript-focus";

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
      refetchInterval: serverActive ? 30_000 : false,
      refetchOnWindowFocus: true,
    },
  });
  const transcript =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data
      : null;
  const persisted = useMemo(() => transcript?.segments ?? [], [transcript]);
  const segments = useMemo(() => {
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

    // 묶지 않는다 — 세그먼트 하나가 행 하나다(`presentation.ts` 주석 참조).
    // 순서는 `interleaveTranscript`가 회의 축으로 세운다.
    return [...rows.values()];
  }, [
    liveForNote,
    liveTranscript.finalSegments,
    noteRealtime.transcript.finalSegments,
    persisted,
  ]);
  const rows = useMemo(
    () => interleaveTranscript(segments, toGapRows(transcript?.gaps ?? [])),
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

  const partial = useMemo(() => {
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
    if (!live) return null;
    const settled =
      noteRealtime.transcript.finalSegments.some(
        (segment) => segment.utteranceId === live.utteranceId
      ) ||
      (liveForNote &&
        liveTranscript.finalSegments.some(
          (segment) => segment.utteranceId === live.utteranceId
        ));
    if (settled) return null;

    // **앞쪽 공백만 턴다.** 두 토막 사이의 공백은 어절 경계라 지우면 단어가 붙는다.
    // 확정 토막이 비어 있으면 미확정 토막이 첫머리이므로 그쪽을 턴다.
    const confirmedText = live.confirmedText.trimStart();
    const pendingText = confirmedText
      ? live.pendingText
      : live.pendingText.trimStart();
    if (!confirmedText && !pendingText.trim()) return null;
    return { confirmedText, pendingText };
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
  /**
   * **id 만으로는 부족하다.** 서버는 같은 `segmentId` 로 교정본을 다시 보내고
   * (`note-realtime-provider` 가 segmentId 로 교체한다), 30초 REST 재조회도 같은 행의
   * 문장을 길게 바꿔 놓는다. 그때 행 높이는 자라는데 scroll 이벤트는 안 나서, 텍스트를
   * 빼면 추종 중인 독자가 바닥에서 밀린 채로 남는다 — 「맨 아래로」 버튼도 안 뜬다.
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
  const { segmentRef, isHighlighted, markProps } = useTranscriptFocus(
    segments,
    {
      focusSegmentId,
      onFocusHandled,
    }
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
        {/* **머리글이 아니라 손잡이다.** v5가 이 면에서 걷어낸 것은 대문자 키커와 세리프
            제목이었다 — 위치를 두 번 말하는 글자였다. 이 바는 글자가 아니라 지금 보고 있는
            것에 대고 할 수 있는 일이고, 아카이브의 같은 자리와 짝을 이룬다. 복사할 것이
            없으면 서지도 않는다. */}
        {/* **조회가 실패했으면 서지 않는다.** REST가 실패해도 실시간으로 들어온 줄은
            화면에 남으므로 `rows`는 차 있다 — 그걸 복사하면 앞부분이 통째로 빠진 회의록이
            남는다. 화면은 스스로 낫지만 복사본은 안 낫는다. */}
        {noteMeta && rows.length && !transcriptQuery.isError ? (
          <div className="sticky top-0 z-10 -mt-5 flex justify-end bg-white pb-2 pt-5">
            <CopyMarkdownButton
              label="전사"
              // 중지 뒤 최종 재조회와 30초 폴링이 도는 동안은 무엇이 최종본인지 모른다.
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
                  // **받아 적는 중인 줄은 빼고 나간다.** `rows`는 확정된 것만 담는다 —
                  // 아직 바뀔 글자를 회의록에 넣으면 붙여넣은 쪽만 틀린 문장을 갖는다.
                  rows,
                  speakerNameOf: (label) =>
                    diarized ? (speakerOf(label)?.displayName ?? null) : null,
                })
              }
            />
          </div>
        ) : null}
        {/* v5: 제품 면 대문자 키커·세리프 헤더 제거 — 탭이 이미 위치를 말한다(FORM SPEC).
            녹음 상태는 상단바·레코더 독이 표시한다. 전사 행이 바로 시작한다. */}
        <section
          role={transcriptQuery.isPending ? undefined : "log"}
          aria-label="회의 전사"
        >
          {transcriptQuery.isPending ? (
            /* **실제 행과 같은 격자·같은 여백이다.** 예전에는 `h-24`/`h-28` 막대 둘이라
               시각 열도 행 경계도 없었고, 도착하는 순간 모양이 통째로 바뀌었다. */
            <div aria-label="대화 기록 불러오는 중">
              {TRANSCRIPT_SKELETON_WIDTHS.map((width, row) => (
                <div
                  key={row}
                  className="grid grid-cols-1 gap-2 border-b border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
                >
                  <Skeleton className="mt-1 h-3 w-10 rounded-chip sm:w-32" />
                  {/* 실제 발화는 `text-read`(15)·leading-7이라 한 줄이 28이다 — 막대는 그 줄
                      안에 놓는다. 막대 높이만 맞추면(16) 행이 12px 낮아진다. */}
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
                    /* 훅이 도착하는 순간 이 줄에 포커스를 옮긴다 — 키보드·스크린리더도
                       각주를 따라와야 한다. **짚힌 줄에만 달지 않는다**: 형광이 꺼질 때
                       속성이 사라지면서 읽던 사람의 포커스를 빼앗는다. `-1`은 Tab 순서에
                       안 들어가므로 늘 달려 있어도 훑는 데 걸리지 않는다. */
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
                  /* **글이 상자 벽에 붙지 않게 안쪽 여백을 준다.** 그러면서 `-mx-4` 로 그만큼
                     끌어내 **본문 x 좌표는 확정 행과 같게** 둔다 — 확정되는 순간 같은 자리에서
                     바뀌어야지, 글자가 옆으로 튀면 읽던 줄을 놓친다. */
                  className="-mx-4 mt-2 grid grid-cols-1 gap-2 rounded-chip bg-[var(--el-canvas-soft)] px-4 py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
                >
                  {/* 확정 행의 시각 열과 같은 크기·색이다. 여기만 크고 붉으면 정작 읽어야 할
                      본문보다 딱지가 먼저 눈에 든다. 살아 있다는 신호는 점이 한다.
                      「확정 전」은 우리 쪽 말이라 뺐다 — 사람에게는 받아 적는 중인 글이다. */}
                  <span className="flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap pt-1 text-[11px] text-[var(--el-muted)] sm:w-32">
                    <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                    받아 적는 중
                  </span>
                  {/* **한 줄 안에서 농도가 갈린다.** 업체가 확정한 앞부분은 다시 안 바뀌므로
                      확정 행과 같은 `--el-ink` 로 두고, 다음 snapshot 이 갈아치울 뒷부분만
                      옅게 둔다. 예전에는 둘을 이어 붙인 문자열 하나만 와서 이미 굳은 글자까지
                      통째로 흐렸다 — 읽는 사람은 안 바뀔 말을 계속 기다렸다. */}
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
