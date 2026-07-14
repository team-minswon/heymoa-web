"use client";

import { useRecording } from "@/components/transcription/recording-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";

type TranscriptRow = {
  segmentId: string;
  sequence: number;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
};

function formatOffset(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

export function TranscriptView({ noteId }: { noteId: string }) {
  const transcriptQuery = useGetNoteTranscript(noteId);
  const recording = useRecording();
  const persisted =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? (transcriptQuery.data.data.data.segments ?? [])
      : [];
  const liveForNote = recording.session?.noteId === noteId;
  const rows = new Map<string, TranscriptRow>();

  persisted.forEach((segment) => rows.set(segment.segmentId, segment));
  if (liveForNote) {
    recording.transcript.finalSegments.forEach((segment) =>
      rows.set(segment.segmentId, segment)
    );
  }
  const orderedSegments = [...rows.values()].sort(
    (a, b) => a.sequence - b.sequence
  );
  const active = Boolean(
    liveForNote &&
      [
        "requesting-permission",
        "connecting",
        "recording",
        "stopping",
      ].includes(recording.phase)
  );

  return (
    <div className="mx-auto max-w-4xl">
      <section className="min-w-0 p-5 pt-6 sm:p-8 sm:pt-10">
        {recording.error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{recording.error}</AlertDescription>
          </Alert>
        ) : null}

        {transcriptQuery.isPending ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : (
          <div className="mt-6 space-y-1">
            {orderedSegments.map((segment) => (
              <article
                key={segment.segmentId}
                data-testid="final-segment"
                data-sequence={segment.sequence}
                data-state="final"
                className="group grid grid-cols-[48px_1fr] gap-3 border-b border-[var(--el-hairline)] py-4"
              >
                <time className="pt-1 font-mono text-[11px] text-[var(--el-muted)]">
                  {formatOffset(segment.startedAtMs)}
                </time>
                <p className="text-sm leading-7 text-[var(--el-ink)] sm:text-[15px]">
                  {segment.text}
                </p>
              </article>
            ))}
            {liveForNote
              ? Object.entries(
                  recording.transcript.partialByUtteranceId
                ).map(([utteranceId, text]) => (
                  <article
                    key={utteranceId}
                    data-state="partial"
                    className="mt-3 rounded-2xl border border-dashed border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-4"
                  >
                    <Badge variant="outline">전사 중</Badge>
                    <p
                      data-state="partial"
                      className="mt-2 text-sm leading-7 text-[var(--el-muted)]"
                    >
                      {text}
                    </p>
                  </article>
                ))
              : null}
            {!orderedSegments.length && !active ? (
              <div className="py-20 text-center text-sm text-[var(--el-muted)]">
                기록을 시작하면 확정된 문장이 여기에 쌓입니다.
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
