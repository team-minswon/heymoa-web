"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

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
import { cn } from "@/lib/utils";

function Count({ children }: { children: React.ReactNode }) {
  // 숫자가 바뀌면 그 숫자만 한 번 스며든다 — 방금 고른 것이 무엇을 바꿨는지 눈이 따라간다.
  return (
    <b
      key={String(children)}
      className="inline-block font-semibold tabular-nums text-[var(--el-ink)] animate-in fade-in-0 zoom-in-95 duration-200 ease-out motion-reduce:animate-none"
    >
      {children}
    </b>
  );
}

/**
 * 검토 완료 — 아래 가운데 떠 있는 막대(APP-865). 고를 제안이 남았으면 그 수와 그 줄로 가는 링크를,
 * 다른 까닭으로 막혔으면 까닭을, 아니면 무엇이 프로젝트에 올라가는지를 말한다. 확정은 되돌릴 수 없어서
 * 한 번 더 묻는다. 기존 할 일 변경도 이때 함께 적용된다.
 */
export function ConfirmBar({
  summary,
  decisions,
  pending,
  blocked = null,
  unchosen = 0,
  onShowUnchosen,
  error = null,
  raised = false,
  onConfirm,
}: {
  summary: ConfirmSummary;
  /** 프로젝트에 올라갈 결정 수 */
  decisions: number;
  pending: boolean;
  /** 지금 확정하면 안 되는 까닭. 저장 · 반영이 끝나지 않았거나 고를 제안이 아직 안 섰다 */
  blocked?: string | null;
  /** 아직 고르지 않은 제안 수. 있으면 까닭 대신 「확인할 제안」과 링크가 선다 */
  unchosen?: number;
  onShowUnchosen?: () => void;
  /** 마지막 확정이 거절된 까닭. 사라지는 토스트가 아니라 여기 남아야 왜 막혔는지 다시 볼 수 있다 */
  error?: string | null;
  /** 넓은 화면에서 「이 회의에 대해 물어보기」 알약이 같은 자리에 떠 있다. 그 위로 올라간다 */
  raised?: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  const t = useTranslations("notes.review.confirm");
  const tAction = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const count = (chunks: React.ReactNode) => <Count>{chunks}</Count>;

  return (
    <div
      className={cn(
        "pointer-events-none sticky bottom-0 z-10 mt-auto flex justify-center px-[var(--note-gutter)] pb-5",
        raised && "lg:pb-[84px]"
      )}
    >
      {/* 막대 뒤로 글이 스며 사라진다 — 마지막 줄이 막대 밑에 걸려도 읽히지 않는 경계가 생기지 않게 */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-10 bottom-0 bg-gradient-to-b from-transparent to-[var(--el-surface-card)] to-60%"
      />
      <div className="pointer-events-auto relative flex min-h-[50px] max-w-full flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[14px] border border-[var(--el-hairline)] bg-[var(--el-surface-card)]/[0.98] py-[7px] pr-[7px] pl-[18px] shadow-e2 animate-in slide-in-from-bottom-2 fade-in-0 duration-200 ease-out motion-reduce:animate-none">
        {error && !blocked ? (
          <span
            role="alert"
            className="text-[13px] text-[var(--el-error-strong)]"
          >
            {error}
          </span>
        ) : unchosen > 0 ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#b4501f]">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-[#eb6834]"
              />
              <span>{t.rich("unchosen", { count: unchosen, b: count })}</span>
            </span>
            {onShowUnchosen ? (
              <button
                type="button"
                onClick={onShowUnchosen}
                className="text-[13px] text-[var(--el-body)] underline decoration-[var(--el-hairline-strong)] underline-offset-[3px] hover:text-[var(--el-ink)]"
              >
                {t("goToSuggestions")}
              </button>
            ) : null}
          </span>
        ) : blocked ? (
          <span className="text-[13px] text-[var(--el-muted)]">{blocked}</span>
        ) : (
          <span className="text-[13.5px] text-[var(--el-body)]">
            {decisions + summary.newTasks === 0
              ? t("nothingToAdd")
              : t.rich("adding", {
                  decisions,
                  tasks: summary.newTasks,
                  b: count,
                })}
            {summary.endedDecisions > 0 ? (
              <>
                {" · "}
                {t.rich("ending", { count: summary.endedDecisions, b: count })}
              </>
            ) : null}
            {summary.changedTasks > 0 ? (
              <>
                {" · "}
                {t.rich("changing", { count: summary.changedTasks, b: count })}
              </>
            ) : null}
          </span>
        )}
        <span
          aria-hidden
          className="hidden h-5 w-px bg-[var(--el-hairline)] sm:block"
        />
        <Button
          className="ml-auto h-9 rounded-[9px] px-4 text-[13px]"
          loading={pending}
          disabled={Boolean(blocked)}
          onClick={() => setOpen(true)}
        >
          {t("finish")}
        </Button>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {[
                t("dialog.adds", { decisions, tasks: summary.newTasks }),
                summary.endedDecisions > 0
                  ? t("dialog.ends", { count: summary.endedDecisions })
                  : null,
                summary.changedTasks > 0
                  ? t("dialog.changes", { count: summary.changedTasks })
                  : null,
                t("dialog.final"),
              ]
                .filter(Boolean)
                .join(" ")}
            </AlertDialogDescription>
            {error ? (
              <p role="alert" className="text-sm text-[var(--el-error-strong)]">
                {error}
              </p>
            ) : null}
            {blocked ? (
              <p role="alert" className="text-sm text-[var(--el-muted)]">
                {blocked}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {tAction("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              loading={pending}
              disabled={Boolean(blocked)}
              onClick={async () => {
                if (await onConfirm()) setOpen(false);
              }}
            >
              {t("finish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
