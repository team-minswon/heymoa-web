"use client";

import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useRecording } from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import {
  getListNoteTranscriptSegmentsQueryKey,
  useDeleteTranscriptSegment,
  useListNoteTranscriptSegments,
  useListNoteTranscriptionSessions,
} from "@/lib/api/generated/transcription/transcription";

function formatOffset(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

export function TranscriptView({ noteId }: { noteId: string }) {
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState<string | null>("ko");
  const sessionsQuery = useListNoteTranscriptionSessions(noteId, {
    limit: 100,
  });
  const segmentsQuery = useListNoteTranscriptSegments(noteId, { limit: 100 });
  const deleteSegment = useDeleteTranscriptSegment();
  const recording = useRecording();
  const sessions =
    sessionsQuery.data?.status === 200 && sessionsQuery.data.data.success
      ? (sessionsQuery.data.data.data?.items ?? [])
      : [];
  const persisted =
    segmentsQuery.data?.status === 200 && segmentsQuery.data.data.success
      ? (segmentsQuery.data.data.data?.items ?? [])
      : [];
  const liveForNote = recording.session?.noteId === noteId;
  const segments = new Map(
    persisted.map((segment) => [segment.segmentId, segment])
  );
  if (liveForNote) {
    recording.transcript.finalSegments.forEach((segment) =>
      segments.set(segment.segmentId, segment)
    );
  }
  const orderedSegments = [...segments.values()].sort(
    (a, b) => a.sequence - b.sequence
  );
  const active =
    liveForNote &&
    recording.session &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      recording.session.status
    );
  const otherActive =
    !liveForNote &&
    recording.session &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      recording.session.status
    );

  return (
    <div className="grid min-h-[620px] lg:grid-cols-[180px_1fr]">
      <aside className="border-b border-[var(--el-hairline)] p-5 lg:border-b-0 lg:border-r">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--el-muted)]">
          Sessions
        </p>
        <div className="mt-4 space-y-2">
          {sessions.map((session, index) => (
            <div
              key={session.sessionId}
              className="rounded-lg bg-white/70 px-3 py-2.5"
            >
              <p className="text-xs font-medium">
                기록 {sessions.length - index}
              </p>
              <p className="mt-1 font-mono text-[10px] text-[var(--el-muted)]">
                {session.status}
              </p>
            </div>
          ))}
        </div>
      </aside>

      <section className="p-6 sm:p-10">
        <div className="flex flex-col justify-between gap-5 border-b border-[var(--el-hairline)] pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--el-muted)]">
              Raw transcript
            </p>
            <h2 className="mt-2 font-serif text-3xl font-light tracking-tight">
              원본 기록
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!active && (
              <select
                value={language ?? "auto"}
                onChange={(event) =>
                  setLanguage(
                    event.target.value === "auto" ? null : event.target.value
                  )
                }
                className="h-9 rounded-full border border-[var(--el-hairline-strong)] bg-white px-3 text-xs outline-none"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="auto">자동 감지</option>
              </select>
            )}
            {otherActive ? (
              <span className="rounded-full bg-[var(--el-surface-strong)] px-3 py-2 text-xs text-[var(--el-muted)]">
                다른 노트 기록 중
              </span>
            ) : !active ? (
              <Button
                type="button"
                onClick={() => void recording.start(noteId, language)}
                className="rounded-full bg-[var(--el-primary)] px-4 text-white"
              >
                <Mic /> 기록 시작
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void (recording.session?.status === "PAUSED"
                      ? recording.resume()
                      : recording.pause())
                  }
                  className="rounded-full"
                >
                  {recording.session?.status === "PAUSED" ? (
                    <Play />
                  ) : (
                    <Pause />
                  )}
                  {recording.session?.status === "PAUSED"
                    ? "재개"
                    : "일시 정지"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void recording.stop()}
                  className="rounded-full"
                >
                  <Square /> 종료
                </Button>
              </>
            )}
          </div>
        </div>

        {recording.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {recording.error}
          </p>
        )}

        <div className="mt-8 space-y-1">
          {orderedSegments.map((segment) => (
            <article
              key={segment.segmentId}
              className="group grid grid-cols-[48px_1fr_auto] gap-3 border-b border-[var(--el-hairline-soft)] py-4"
            >
              <time className="pt-0.5 font-mono text-[11px] text-[var(--el-muted)]">
                {formatOffset(segment.startedAtMs)}
              </time>
              <p className="text-[15px] leading-7 text-[var(--el-body)]">
                {segment.text}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="스크립트 삭제"
                onClick={async () => {
                  await deleteSegment.mutateAsync({
                    segmentId: segment.segmentId,
                  });
                  await queryClient.invalidateQueries({
                    queryKey: getListNoteTranscriptSegmentsQueryKey(noteId),
                  });
                }}
                className="rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 />
              </Button>
            </article>
          ))}
          {liveForNote &&
            Object.entries(recording.transcript.partialByItemId).map(
              ([itemId, text]) => (
                <article
                  key={itemId}
                  className="grid grid-cols-[48px_1fr] gap-3 py-4 text-[var(--el-muted)]"
                >
                  <span className="flex items-center">
                    <span className="size-2 animate-pulse rounded-full bg-[var(--el-ink)]" />
                  </span>
                  <p className="text-[15px] italic leading-7">{text}</p>
                </article>
              )
            )}
          {!segmentsQuery.isPending &&
            orderedSegments.length === 0 &&
            !active && (
              <div className="py-24 text-center text-sm text-[var(--el-muted)]">
                기록을 시작하면 확정된 문장이 여기에 쌓입니다.
              </div>
            )}
        </div>
      </section>
    </div>
  );
}
