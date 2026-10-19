"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

/** 목록 캐시에서 그 노트 행만 뺀다. 모양이 예상과 다르면 손대지 않는다. */
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

/**
 * 회의 삭제 확인.
 *
 * 회의 소유 데이터는 함께 지우며, 프로젝트로 승계된 결정사항·할 일과 개인 대화는 유지합니다.
 *
 * 실패 토스트는 안 띄운다. `MutationCache.onError`가 전역으로 잡으므로 여기서 또 부르면 두 개가
 * 겹친다(rule `error-loading`).
 */
export function NoteDeleteDialog({
  noteId,
  projectId,
  title,
  open,
  onOpenChange,
  onDeleted,
}: {
  noteId: string;
  projectId?: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 삭제 성공 뒤 — 상세는 목록으로 되돌아간다. */
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const recording = useRecording();
  const deleteNote = useDeleteNote();
  const flowQuery = useGetAnalysisFlow(noteId, {
    query: {
      enabled: open,
      staleTime: 0,
      refetchInterval: (query) =>
        flowPollInterval(okData(query.state.data)?.status ?? null),
    },
  });
  const flow = okData(flowQuery.data);
  const analyzing = flow?.status === "ANALYZING";
  // `deleteNote.isPending`은 DELETE가 끝나면 바로 false가 된다. 캐시 정리와 이동이 남았는데
  // 버튼이 다시 살아나면 지운 노트로 DELETE가 한 번 더 나가 404 토스트가 성공 토스트와
  // 나란히 뜬다. 후처리까지 덮는 잠금을 따로 둔다.
  const [busy, setBusy] = useState(false);
  const locked = deleteNote.isPending || busy;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>「{title}」을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            녹음·스크립트·요약과 회의의 발화 근거가 삭제됩니다. 진행 중인 녹음도
            종료됩니다. 프로젝트로 승계된 결정사항·할 일과 개인 대화는 남습니다.
            되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {analyzing ? (
          <p role="status" className="text-sm text-muted-foreground">
            분석 중에는 삭제할 수 없습니다.
          </p>
        ) : flowQuery.isError ? (
          <InlineRetry
            variant="line"
            label="분석 상태를 불러오지 못했습니다."
            onRetry={() => void flowQuery.refetch()}
          />
        ) : flowQuery.isFetching ? (
          <p className="text-sm text-muted-foreground">
            분석 상태를 확인하고 있습니다.
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locked}>취소</AlertDialogCancel>
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
              // **거절을 여기서 소비한다.** `MutationCache.onError`는 토스트만 띄우고
              // Promise를 삼키지 않아서, catch가 없으면 409·404·네트워크 실패가
              // unhandled rejection으로 남는다.
              const response = await deleteNote
                .mutateAsync({ noteId })
                .catch(() => null);
              if (response?.status !== 204) {
                setBusy(false);
                return;
              }
              await recording.disconnect(noteId);
              // 삭제 전에 시작된 비활성 목록 조회도 취소해야 늦은 응답이 행을 되살리지 않습니다.
              await queryClient.cancelQueries({
                predicate: ({ queryKey }) => isNoteListQueryKey(queryKey),
              });
              // **그 노트를 키에 담은 캐시를 전부 버린다.** 단건만 지우면 전사·요약·공유
              // 채팅이 각자 키를 써서 살아남고, `NotePanel`은 단건이 404여도 탭을 마운트하므로
              // 뒤로가기로 돌아갔을 때 지운 회의 내용이 다시 그려진다.
              queryClient.removeQueries({
                predicate: (query) =>
                  // 문자열로 펴서 본다. 노트 상세를 담은 키 중에는
                  // `["/v1/notes/{noteId}/transcript", { cursor }]`처럼 noteId가 객체
                  // 안에 있는 것도 있어 최상위 문자열 검사로는 안 걸린다.
                  JSON.stringify(query.queryKey).includes(noteId),
              });
              // 목록은 재조회 전에 행을 먼저 뺀다 — `invalidateQueries`는 재조회가 실패해도
              // resolve하고 옛 데이터를 남겨서, 지운 행이 그대로 보인다.
              //
              // **목록이 둘이다** (APP-685). 프로젝트 것만 빼면 「모든 노트」 화면에 지운 행이
              // 그대로 서 있다. 캐시에 있는 것만 손대므로 없는 키는 그냥 지나간다.
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
              toast.success("회의를 삭제했습니다.");
              onOpenChange(false);
              onDeleted?.();
            }}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
