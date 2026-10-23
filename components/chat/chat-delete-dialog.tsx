"use client";

import { useState } from "react";

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

/**
 * 대화 삭제 확인(APP-1409). 기록 줄의 휴지통과 대화 위쪽의 「대화 삭제」가 함께 쓴다.
 *
 * 실패 알림은 [onConfirm] 쪽(`useChatTurn.deleteChat`)이 띄운다. 여기는 누른 뒤 끝날 때까지 버튼을 잠그고, 성공하면 닫는다.
 */
export function ChatDeleteDialog({
  target,
  onOpenChange,
  onConfirm,
}: {
  /** 지울 대화. null 이면 닫혀 있다. */
  target: { chatId: string; title: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (chatId: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>대화를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription
            render={<div />}
            className="space-y-3 text-left"
          >
            <p className="break-words font-medium text-foreground">
              {target?.title}
            </p>
            <p>
              이 대화의 질문과 답, 승인 기록이 함께 삭제되며 되돌릴 수 없습니다.
              답이 만들어지는 중이라면 멈춥니다.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            loading={busy}
            disabled={busy || target === null}
            onClick={async () => {
              if (!target) return;
              setBusy(true);
              const deleted = await onConfirm(target.chatId);
              setBusy(false);
              if (deleted) onOpenChange(false);
            }}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
