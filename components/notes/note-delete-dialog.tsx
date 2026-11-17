"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/ui/toast";

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
import { useDeleteNote } from "@/lib/api/generated/notes/notes";
import { useGetAnalysisFlow } from "@/lib/api/generated/analysis/analysis";
import { getGetProjectMeetingLinksQueryKey } from "@/lib/api/generated/projects/projects";
import { okData } from "@/lib/api/ok-data";
import { useRecording } from "@/components/transcription/recording-provider";
import { InlineRetry } from "@/components/ui/inline-retry";
import { invalidateNoteLists } from "@/lib/notes/invalidate";
import { isNoteListQueryKey } from "@/lib/notes/query-keys";
import { flowPollInterval } from "@/lib/notes/review/flow-cache";
import { useEventStreamHealthy } from "@/lib/events/health";
import { hintedInterval } from "@/lib/events/interval";

function dropNoteFromList(current: unknown, noteId: string) {
  const response = current as
    | {
        status?: number;
        data?: { success?: boolean; data?: { notes?: { noteId: string }[] } };
      }
    | undefined;
  const notes = response?.data?.data?.notes;
  if (response?.status !== 200 || !response.data?.success || !notes)
    return current;
  return {
    ...response,
    data: {
      ...response.data,
      data: {
        ...response.data.data,
        notes: notes.filter((note) => note.noteId !== noteId),
      },
    },
  };
}

export function NoteDeleteDialog({
  workspaceId,
  noteId,
  projectId,
  title,
  open,
  onOpenChange,
  onDeleted,
}: {
  workspaceId: string;
  noteId: string;
  projectId?: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("notes.deleteDialog");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const recording = useRecording();
  const deleteNote = useDeleteNote();
  const streamHealthy = useEventStreamHealthy();
  const flowQuery = useGetAnalysisFlow(noteId, {
    query: {
      enabled: open,
      staleTime: 0,
      refetchInterval: (query) =>
        hintedInterval(
          streamHealthy,
          flowPollInterval(okData(query.state.data)?.status ?? null)
        ),
    },
  });
  const flow = okData(flowQuery.data);
  const analyzing = flow?.status === "ANALYZING";
  const [busy, setBusy] = useState(false);
  const locked = deleteNote.isPending || busy;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription
            render={<div />}
            className="space-y-3 text-left"
          >
            <p className="break-words font-medium text-foreground">{title}</p>
            <p>{t("description")}</p>
            <p>{t("chats")}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {analyzing ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("analyzing")}
          </p>
        ) : flowQuery.isError ? (
          <InlineRetry
            variant="line"
            label={t("flowFailed")}
            onRetry={() => void flowQuery.refetch()}
          />
        ) : flowQuery.isFetching ? (
          <p className="text-sm text-muted-foreground">
            {t("flowChecking")}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locked}>
            {tActions("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            loading={locked}
            disabled={
              locked ||
              analyzing ||
              !flow ||
              flowQuery.isFetching ||
              flowQuery.isError
            }
            onClick={async () => {
              setBusy(true);
              // `MutationCache.onError` 는 토스트만 띄우고 Promise 를 삼키지 않아, catch 가 없으면 unhandled rejection 으로 남는다.
              const variables = { noteId, workspaceId };
              const response = await deleteNote
                .mutateAsync(variables)
                .catch(() => null);
              if (response?.status !== 204) {
                setBusy(false);
                return;
              }
              await recording.disconnect(noteId);
              await queryClient.cancelQueries({
                predicate: ({ queryKey }) => isNoteListQueryKey(queryKey),
              });
              queryClient.removeQueries({
                predicate: (query) =>
                  JSON.stringify(query.queryKey).includes(noteId),
              });
              // `invalidateQueries` 는 재조회가 실패해도 resolve 하고 옛 데이터를 남기므로 목록에서 행을 먼저 뺀다.
              queryClient.setQueriesData(
                { predicate: ({ queryKey }) => isNoteListQueryKey(queryKey) },
                (current: unknown) => dropNoteFromList(current, noteId)
              );
              await Promise.all([
                invalidateNoteLists(queryClient),
                // removeQueries만으로는 이미 열린 연결 화면의 observer가 옛 값을 계속 보여줍니다.
                projectId
                  ? queryClient.resetQueries({
                      queryKey: getGetProjectMeetingLinksQueryKey(projectId),
                    })
                  : Promise.resolve(),
              ]);
              toast.success(t("deleted"));
              onOpenChange(false);
              onDeleted?.();
            }}
          >
            {tActions("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
