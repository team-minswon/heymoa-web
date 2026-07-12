"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useRecording } from "@/components/transcription/recording-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import type { TranscriptSegmentResponse } from "@/lib/api/generated/models";
import {
  getListNoteTranscriptSegmentsQueryKey,
  useDeleteTranscriptSegment,
  useListNoteTranscriptSegments,
} from "@/lib/api/generated/transcription/transcription";

function formatOffset(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

export function TranscriptView({ noteId }: { noteId: string }) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] =
    useState<TranscriptSegmentResponse | null>(null);
  const segmentsQuery = useListNoteTranscriptSegments(noteId, { limit: 100 });
  const deleteSegment = useDeleteTranscriptSegment();
  const recording = useRecording();
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
  const active = Boolean(
    liveForNote &&
    recording.session &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      recording.session.status
    )
  );
  const bars = recording.levelHistory.length
    ? recording.levelHistory
    : Array(24).fill(0);

  return (
    <div className="mx-auto max-w-3xl">
      <section className="min-w-0 p-5 sm:p-8 pt-6 sm:pt-10">
        {active ? (
          <div className="rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas)] p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[var(--el-muted)]">
              <span>
                {recording.session?.status === "PAUSED"
                  ? "일시정지"
                  : "실시간 전사"}
              </span>
              <span className="font-mono">
                {formatOffset(recording.elapsedMs)}
              </span>
            </div>
            <svg
              role="meter"
              aria-label="실시간 마이크 파형"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(recording.level * 100)}
              viewBox="0 0 320 48"
              className="h-12 w-full fill-[var(--el-ink)]"
            >
              {bars.map((sample, index) => {
                const height = Math.round(Math.max(3, sample * 44) * 10) / 10;
                return (
                  <rect
                    key={index}
                    data-testid={`wave-bar-${index}`}
                    x={index * (320 / bars.length) + 2}
                    y={24 - height / 2}
                    width={Math.max(3, 320 / bars.length - 5)}
                    height={height}
                    rx="2"
                  />
                );
              })}
            </svg>
          </div>
        ) : null}

        {recording.error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{recording.error}</AlertDescription>
          </Alert>
        ) : null}

        {segmentsQuery.isPending ? (
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
                className="group grid grid-cols-[48px_1fr_auto] gap-3 border-b py-4"
              >
                <time className="pt-1 font-mono text-[11px] text-muted-foreground">
                  {formatOffset(segment.startedAtMs)}
                </time>
                <p className="text-sm leading-7 sm:text-[15px]">
                  {segment.text}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="스크립트 삭제"
                  onClick={() => setDeleteTarget(segment)}
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
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
                    <Badge variant="outline">전사 중</Badge>
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>스크립트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 확정 문장만 삭제되며 나머지 순서는 유지됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                await deleteSegment.mutateAsync({
                  segmentId: deleteTarget.segmentId,
                });
                await queryClient.invalidateQueries({
                  queryKey: getListNoteTranscriptSegmentsQueryKey(noteId),
                });
                setDeleteTarget(null);
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
