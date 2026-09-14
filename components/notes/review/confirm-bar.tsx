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
import { Button } from "@/components/ui/button";
import type { ConfirmSummary } from "@/lib/notes/review/confirm";

function Count({ value }: { value: number }) {
  // 숫자가 바뀌면 그 숫자만 한 번 스며든다 — 방금 고른 것이 무엇을 바꿨는지 눈이 따라간다.
  return (
    <b
      key={value}
      className="inline-block font-semibold tabular-nums text-[var(--el-ink)] animate-in fade-in-0 zoom-in-95 duration-200 ease-out motion-reduce:animate-none"
    >
      {value}
    </b>
  );
}

/**
 * 검토 완료. 확정은 되돌릴 수 없어서 한 번 더 묻는다 — 무엇이 프로젝트에 들어가고 무엇이 끝나는지를
 * 그 자리에서 말한다. 기존 할 일 변경은 「반영」 때 이미 저장됐다.
 */
export function ConfirmBar({
  summary,
  pending,
  blocked = null,
  error = null,
  onConfirm,
}: {
  summary: ConfirmSummary;
  pending: boolean;
  /** 지금 확정하면 안 되는 까닭. 저장 · 반영이 끝나지 않았거나 고를 제안이 아직 안 섰다 */
  blocked?: string | null;
  /** 마지막 확정이 거절된 까닭. 사라지는 토스트가 아니라 여기 남아야 왜 막혔는지 다시 볼 수 있다 */
  error?: string | null;
  onConfirm: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-[var(--note-gutter)] py-3.5 shadow-[0_-8px_24px_#0c0a090a] animate-in slide-in-from-bottom-2 fade-in-0 duration-200 ease-out motion-reduce:animate-none">
      <div className="mx-auto flex w-full max-w-[820px] flex-wrap items-center justify-between gap-x-5 gap-y-2">
      <p className="text-xs leading-[18px] text-[var(--el-muted)]">
        할 일 <Count value={summary.newTasks} />개 추가 · 이전 결정 <Count value={summary.endedDecisions} />개 끝남 ·
        기존 할 일 <Count value={summary.changedTasks} />개 변경
      </p>
      <span className="ml-auto flex items-center gap-3">
        {error ? (
          <span role="alert" className="text-xs text-[var(--el-error-strong)]">
            {error}
          </span>
        ) : blocked ? (
          <span className="text-xs text-[var(--el-muted)]">{blocked}</span>
        ) : null}
        <Button
          className="h-9 rounded-full px-[18px]"
          loading={pending}
          disabled={Boolean(blocked)}
          onClick={() => setOpen(true)}
        >
          검토 완료
        </Button>
      </span>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>검토를 완료할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              포함한 항목이 프로젝트에 확정되고 할 일 {summary.newTasks}개가 생깁니다.
              {summary.endedDecisions > 0 ? ` 이전 결정 ${summary.endedDecisions}개가 끝납니다.` : ""} 완료한 뒤에는 검토를
              고칠 수 없습니다.
            </AlertDialogDescription>
            {error ? (
              <p role="alert" className="text-sm text-[var(--el-error-strong)]">
                {error}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (await onConfirm()) setOpen(false);
              }}
            >
              검토 완료
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
