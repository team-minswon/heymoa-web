"use client";

import { Fragment, useEffect, useRef } from "react";
import { Check, Loader2 } from "lucide-react";

import { useRecording } from "@/components/transcription/recording-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";

type TranscriptRow = {
  segmentId: string;
  transcriptionSessionId?: string;
  sequence: number;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
};

type TimelineRow = TranscriptRow & {
  sessionId: string;
  sessionNumber: number;
  startsSession: boolean;
  timelineStartedAtMs: number;
  timelineEndedAtMs: number;
};

function formatOffset(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

function buildTranscriptTimeline(segments: TranscriptRow[]) {
  let sessionId: string | null = null;
  let sessionNumber = 0;
  let previousSessionsDurationMs = 0;
  let currentSessionDurationMs = 0;

  return segments.map<TimelineRow>((segment) => {
    const nextSessionId = segment.transcriptionSessionId ?? "live-session";
    const startsSession = nextSessionId !== sessionId;
    if (startsSession) {
      previousSessionsDurationMs += currentSessionDurationMs;
      currentSessionDurationMs = 0;
      sessionId = nextSessionId;
      sessionNumber += 1;
    }
    currentSessionDurationMs = Math.max(
      currentSessionDurationMs,
      segment.endedAtMs
    );

    return {
      ...segment,
      sessionId: nextSessionId,
      sessionNumber,
      startsSession,
      timelineStartedAtMs: previousSessionsDurationMs + segment.startedAtMs,
      timelineEndedAtMs: previousSessionsDurationMs + segment.endedAtMs,
    };
  });
}

export function TranscriptView({ noteId }: { noteId: string }) {
  const recording = useRecording();
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
  const persisted =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? (transcriptQuery.data.data.data.segments ?? [])
      : [];
  const rows = new Map<string, TranscriptRow>();

  persisted.forEach((segment) => rows.set(segment.segmentId, segment));
  if (liveForNote) {
    recording.transcript.finalSegments.forEach((segment) => {
      rows.set(segment.segmentId, {
        ...segment,
        transcriptionSessionId: recording.session?.sessionId,
      });
    });
  }
  // The API already orders across sessions by session start time and sequence.
  // Re-sorting only by sequence would mix separate recordings of the same note.
  const orderedSegments = buildTranscriptTimeline([...rows.values()]);
  const sessionCount = orderedSegments.at(-1)?.sessionNumber ?? 0;
  const partials = liveForNote
    ? Object.entries(recording.transcript.partialByUtteranceId)
    : [];
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const liveContentKey = `${orderedSegments.at(-1)?.segmentId ?? ""}:${partials
    .map(([, text]) => text)
    .join("\u0000")}`;

  useEffect(() => {
    if (!active) return;
    const end = transcriptEndRef.current;
    const viewport = end?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    const distanceFromBottom = viewport
      ? viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      : document.documentElement.scrollHeight -
        (window.scrollY + window.innerHeight);
    if (distanceFromBottom < 160) {
      end?.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [active, liveContentKey]);

  const statusLabel =
    recording.phase === "requesting-permission"
      ? "마이크 권한 확인 중"
      : recording.phase === "connecting"
        ? "전사 연결 중"
        : recording.phase === "stopping"
          ? "마지막 문장 저장 중"
          : "실시간 기록 중";

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-40 pt-7 sm:px-9 sm:pt-9">
      <section aria-label="회의 전사">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--el-hairline-strong)] pb-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--el-muted)]">
              {active ? (
                <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
              ) : null}
              {active ? statusLabel : "Transcript"}
            </p>
            <p className="mt-2 text-sm text-[var(--el-body)]">
              확정 문장{" "}
              <strong className="font-semibold text-[var(--el-ink)]">
                {orderedSegments.length}
              </strong>
              개{sessionCount > 1 ? ` · 녹음 ${sessionCount}회` : ""}
              {partials.length ? ` · 작성 중 ${partials.length}개` : ""}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--el-muted)]">
            {transcriptQuery.isFetching ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            {transcriptQuery.isError
              ? "동기화 실패"
              : transcriptQuery.isFetching
                ? "저장 중"
                : "저장됨"}
          </span>
        </header>

        {recording.error && liveForNote ? (
          <Alert variant="destructive" className="mt-4 rounded-2xl bg-white">
            <AlertDescription>{recording.error}</AlertDescription>
          </Alert>
        ) : null}

        {transcriptQuery.isPending ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : (
          <div className="mt-3">
            <div>
              {orderedSegments.map((segment) => {
                return (
                  <Fragment key={segment.segmentId}>
                    {sessionCount > 1 && segment.startsSession ? (
                      <div className="flex items-center gap-3 pb-1 pt-6 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--el-muted)] first:pt-3">
                        <span>
                          Recording{" "}
                          {String(segment.sessionNumber).padStart(2, "0")}
                        </span>
                        <span className="h-px flex-1 bg-[var(--el-hairline)]" />
                      </div>
                    ) : null}
                    <article
                      data-testid="final-segment"
                      data-sequence={segment.sequence}
                      data-timeline-start-ms={segment.timelineStartedAtMs}
                      data-state="final"
                      className="group grid grid-cols-[58px_1fr] gap-4 border-b border-[var(--el-hairline)] py-5 sm:grid-cols-[66px_1fr] sm:gap-6"
                    >
                      <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-ink)]">
                        {formatOffset(segment.timelineStartedAtMs)}
                      </time>
                      <p className="max-w-3xl text-[15px] leading-7 tracking-[0.005em] text-[var(--el-ink)]">
                        {segment.text}
                      </p>
                    </article>
                  </Fragment>
                );
              })}
              {partials.map(([utteranceId, text]) => (
                <article
                  key={utteranceId}
                  data-state="partial"
                  aria-live="polite"
                  className="mt-2 grid grid-cols-[58px_1fr] gap-4 rounded-xl border border-red-100 bg-red-50/45 px-3 py-4 sm:grid-cols-[66px_1fr] sm:gap-6"
                >
                  <span className="flex items-center gap-1.5 self-start pt-1 font-mono text-[10px] font-semibold text-red-600">
                    <span className="size-1.5 animate-pulse rounded-full bg-red-500" />{" "}
                    LIVE
                  </span>
                  <p
                    data-state="partial"
                    className="max-w-3xl text-[15px] leading-7 text-[var(--el-body)]"
                  >
                    {text}
                    <span className="ml-1 inline-block h-4 w-px animate-pulse bg-[var(--el-muted)] align-middle" />
                  </p>
                </article>
              ))}
              {!orderedSegments.length && !active ? (
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
                    기록을 시작하고 평소처럼 대화하세요. 문장이 완성되는 순간
                    자동으로 저장됩니다.
                  </p>
                </div>
              ) : null}
              {!orderedSegments.length && active && !partials.length ? (
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
                    자연스럽게 말씀해 주세요. 침묵 구간에서 문장이 확정됩니다.
                  </p>
                </div>
              ) : null}
              <div ref={transcriptEndRef} aria-hidden />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
