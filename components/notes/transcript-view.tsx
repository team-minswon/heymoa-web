"use client";

import { useRecording } from "@/components/transcription/recording-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { TranscriptResponseDataSegmentsItem } from "@/lib/api/generated/models";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";

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
  const segments = new Map<string, TranscriptResponseDataSegmentsItem>();
  
  persisted.forEach((segment) => {
    segments.set(segment.segmentId, segment);
  });
  
  if (liveForNote) {
    recording.transcript.finalSegments.forEach((segment) => {
      // Convert live segment to the same structure
      segments.set(segment.segmentId, {
        segmentId: segment.segmentId,
        transcriptionSessionId: segment.sessionId,
        sequence: segment.sequence,
        text: segment.text,
        startedAtMs: segment.startedAtMs,
        endedAtMs: segment.endedAtMs,
      });
    });
  }
  
  const orderedSegments = [...segments.values()].sort(
    (a, b) => a.sequence - b.sequence
  );
  
  const active = Boolean(
    liveForNote &&
    recording.session &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      recording.session.status
    )
  );

  return (
    <div className="mx-auto max-w-3xl">
      <section className="min-w-0 p-5 sm:p-8 pt-6 sm:pt-10">
        {recording.error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{recording.error}</AlertDescription>
          </Alert>
        ) : null}

        {transcriptQuery.isPending ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <div className="mt-6 space-y-1">
            {orderedSegments.map((segment) => (
              <article
                key={segment.segmentId}
                data-state="final"
                className="group grid grid-cols-[48px_1fr] gap-3 border-b py-4"
              >
                <time className="pt-1 font-mono text-[11px] text-muted-foreground">
                  {formatOffset(segment.startedAtMs ?? 0)}
                </time>
                <p className="text-sm leading-7 sm:text-[15px]">
                  {segment.text}
                </p>
              </article>
            ))}
            {liveForNote &&
              Object.entries(recording.transcript.partialByItemId).map(
                ([itemId, text]) => (
                  <article
                    key={itemId}
                    data-state="partial"
                    className="mt-3 rounded-xl border border-dashed bg-muted/30 p-4"
                  >
                    <time className="font-mono text-[11px] text-muted-foreground">
                      {formatOffset(
                        recording.transcript.partialStartedAtMsByItemId[
                          itemId
                        ] ?? 0
                      )}
                    </time>
                    <Badge variant="outline" className="ml-2">전사 중</Badge>
                    <p
                      data-state="partial"
                      className="mt-2 text-sm leading-7 text-muted-foreground"
                    >
                      {text}
                    </p>
                  </article>
                )
              )}
            {!orderedSegments.length && !active ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                기록을 시작하면 확정된 문장이 여기에 쌓입니다.
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
