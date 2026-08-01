"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import {
  getGetNotesQueryKey,
  useDeleteNote,
} from "@/lib/api/generated/notes/notes";

/** 목록 캐시에서 그 노트 행만 뺀다. 모양이 예상과 다르면 손대지 않는다. */
function dropNoteFromList(current: unknown, noteId: string) {
  const response = current as
    | { status?: number; data?: { success?: boolean; data?: { notes?: { noteId: string }[] } } }
    | undefined;
  const notes = response?.data?.data?.notes;
  if (response?.status !== 200 || !response.data?.success || !notes) return current;
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
 * **물리 삭제라 되돌릴 수 없다**(server APP-335). 전사·요약·챗봇 대화가 FK CASCADE로 함께
 * 사라지므로 문구가 그 셋을 이름으로 말한다 — "삭제됩니다"만 쓰면 무엇까지 사라지는지 모른다.
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
  /** 목록 쿼리 키가 프로젝트 단위라 무효화에 필요하다. */
  projectId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 삭제 성공 뒤 — 상세는 목록으로 되돌아간다. */
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const deleteNote = useDeleteNote();
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
            전사와 요약, 챗봇 대화가 함께 사라집니다. 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locked}>
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            loading={locked}
            disabled={locked}
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
              // **그 노트를 키에 담은 캐시를 전부 버린다.** 단건만 지우면 전사·요약·공유
              // 채팅이 각자 키를 써서 살아남고, `NotePanel`은 단건이 404여도 탭을 마운트하므로
              // 뒤로가기로 돌아갔을 때 지운 회의 내용이 다시 그려진다.
              queryClient.removeQueries({
                predicate: (query) =>
                  // 문자열로 펴서 본다. 개인 챗봇의 활성 세션 키는
                  // `["/v1/agent-chats/active", { scope: "note", noteId }]`처럼 noteId가
                  // 객체 안에 있어서 최상위 문자열 검사로는 안 걸린다.
                  JSON.stringify(query.queryKey).includes(noteId),
              });
              // 목록은 재조회 전에 행을 먼저 뺀다 — `invalidateQueries`는 재조회가 실패해도
              // resolve하고 옛 데이터를 남겨서, 지운 행이 그대로 보인다.
              const notesKey = getGetNotesQueryKey(projectId);
              queryClient.setQueryData(notesKey, (current: unknown) =>
                dropNoteFromList(current, noteId)
              );
              await queryClient.invalidateQueries({ queryKey: notesKey });
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
