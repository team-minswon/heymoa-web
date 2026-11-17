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
  return (
    <b
      key={String(children)}
      className="inline-block font-semibold tabular-nums text-[var(--el-ink)] animate-in fade-in-0 zoom-in-95 duration-200 ease-out motion-reduce:animate-none"
    >
      {children}
    </b>
  );
}

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
  decisions: number;
  pending: boolean;
  blocked?: string | null;
  unchosen?: number;
  onShowUnchosen?: () => void;
  error?: string | null;
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
