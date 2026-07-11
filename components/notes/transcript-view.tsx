"use client";

import { useState } from "react";
import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { TranscriptSegmentResponse } from "@/lib/api/generated/models";
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
  const [language, setLanguage] = useState("ko");
  const [deleteTarget, setDeleteTarget] =
    useState<TranscriptSegmentResponse | null>(null);
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
  const active = Boolean(
    liveForNote &&
    recording.session &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      recording.session.status
    )
  );
  const otherActive = Boolean(
    !liveForNote &&
    recording.session &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      recording.session.status
    )
  );

  return (
    <div className="grid min-h-full lg:grid-cols-[180px_1fr]">
      <aside className="border-b bg-muted/20 p-4 lg:border-r lg:border-b-0">
        <p className="text-xs font-semibold text-muted-foreground">세션</p>
        <div className="mt-3 flex gap-2 overflow-x-auto lg:flex-col">
          {sessions.map((session, index) => (
            <div
              key={session.sessionId}
              className="min-w-32 rounded-lg border bg-background px-3 py-2.5"
            >
              <p className="text-xs font-medium">
                기록 {sessions.length - index}
              </p>
              <Badge variant="outline" className="mt-2 font-mono text-[10px]">
                {session.status}
              </Badge>
            </div>
          ))}
          {!sessionsQuery.isPending && !sessions.length ? (
            <p className="text-xs text-muted-foreground">기록 없음</p>
          ) : null}
        </div>
      </aside>

      <section className="min-w-0 p-5 sm:p-8">
        <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Raw transcript
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              원본 기록
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!active ? (
              <Select
                value={language}
                onValueChange={(value) => value && setLanguage(value)}
              >
                <SelectTrigger aria-label="기록 언어" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ko">한국어</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="auto">자동 감지</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            {otherActive ? (
              <Badge variant="secondary">다른 노트 기록 중</Badge>
            ) : !active ? (
              <Button
                type="button"
                onClick={() =>
                  void recording.start(
                    noteId,
                    language === "auto" ? null : language
                  )
                }
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
                >
                  <Square /> 종료
                </Button>
              </>
            )}
          </div>
        </div>

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
                    className="mt-3 rounded-xl border border-dashed bg-muted/30 p-4"
                  >
                    <Badge variant="outline">전사 중</Badge>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
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
