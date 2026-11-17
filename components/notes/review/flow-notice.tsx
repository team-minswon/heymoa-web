"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  getGetAnalysisFlowQueryKey,
  useRequestAnalysis,
} from "@/lib/api/generated/analysis/analysis";
import type { MeetingAnalysisFlowResponseDataStatus as FlowStatus } from "@/lib/api/generated/models";
import { moveFlowStatus } from "@/lib/notes/review/flow-cache";
import { cn } from "@/lib/utils";

type WaitingStatus = Extract<
  FlowStatus,
  "DIARIZING" | "NOT_REQUESTED" | "ANALYZING" | "ANALYSIS_FAILED"
>;

const STEPS = ["organize", "check", "review", "confirm"] as const;

const CURRENT: Record<
  WaitingStatus,
  { index: number; state: "running" | "waiting" | "failed" }
> = {
  DIARIZING: { index: 0, state: "running" },
  NOT_REQUESTED: { index: 0, state: "waiting" },
  ANALYZING: { index: 0, state: "running" },
  ANALYSIS_FAILED: { index: 0, state: "failed" },
};

export function isWaitingStatus(status: FlowStatus): status is WaitingStatus {
  return status in CURRENT;
}

export function FlowNotice({
  noteId,
  status,
  retryable,
  verified = true,
  compact = false,
  onOpenTranscript,
}: {
  noteId: string;
  status: WaitingStatus;
  retryable: boolean;
  verified?: boolean;
  compact?: boolean;
  onOpenTranscript: () => void;
}) {
  const t = useTranslations("notes.review.flow");
  const queryClient = useQueryClient();
  const request = useRequestAnalysis();
  const inputDelayed = status === "ANALYSIS_FAILED" && !retryable;
  const { index } = CURRENT[status];
  const state = inputDelayed ? "waiting" : CURRENT[status].state;
  const copyKey = inputDelayed ? "INPUT_DELAYED" : status;
  const copy = {
    title: t(`status.${copyKey}.title`),
    body: t(`status.${copyKey}.body`),
  };
  const canRequest = verified && retryable;

  const requestAction = canRequest ? (
    <div className="col-start-2 mt-3">
      <Button
        size="sm"
        loading={request.isPending}
        onClick={() =>
          request.mutate(
            { noteId },
            {
              onSuccess: (response) => {
                if (response.status === 202 && response.data.success) {
                  moveFlowStatus(
                    queryClient,
                    noteId,
                    response.data.data.flowStatus
                  );
                }
                void queryClient.invalidateQueries({
                  queryKey: getGetAnalysisFlowQueryKey(noteId),
                });
              },
            }
          )
        }
      >
        {status === "ANALYSIS_FAILED" ? t("reanalyze") : t("request")}
      </Button>
    </div>
  ) : null;

  if (compact)
    return (
      <div
        role={state === "failed" ? "alert" : "status"}
        className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-5"
      >
        <div className="rounded-block border border-[var(--el-hairline)] px-4 py-3 text-sm leading-6 text-[var(--el-body)]">
          <p className="font-medium text-[var(--el-ink)]">{copy.title}</p>
          <p>{t("kept")}</p>
          {requestAction}
        </div>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-10 pb-16">
      <ol
        aria-label={t("stepsLabel")}
        className="flex flex-wrap items-center gap-2.5 text-xs"
      >
        {STEPS.map((step, at) => {
          const label = t(`steps.${step}`);
          const done = at < index;
          const now = at === index;
          const failed = now && state === "failed";
          const running = now && state === "running";
          const stepState = t(
            `stepState.${done ? "done" : failed ? "failed" : running ? "running" : "waiting"}`
          );
          return (
            <li
              key={step}
              aria-label={t("step", { label, state: stepState })}
              className="flex items-center gap-2.5"
            >
              {at > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-px w-7 transition-colors duration-200 ease-out motion-reduce:transition-none sm:block",
                    at <= index
                      ? "bg-[var(--el-hairline-strong)]"
                      : "bg-[var(--el-hairline)]"
                  )}
                />
              ) : null}
              <span
                aria-current={now ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap",
                  done && "text-[var(--el-body)]",
                  now && "font-semibold text-[var(--el-ink)]",
                  !done && !now && "text-[var(--el-muted-soft)]"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    done &&
                      "border-[var(--el-ink)] bg-[var(--el-ink)] text-[var(--el-on-primary)]",
                    failed &&
                      "border-[var(--el-error)] bg-[var(--el-error)] text-[var(--el-on-primary)]",
                    running &&
                      "border-[var(--el-hairline-strong)] text-[var(--el-ink)]",
                    !done &&
                      !failed &&
                      !running &&
                      "border-[var(--el-hairline-strong)] text-[var(--el-muted-soft)]"
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : null}
                  {failed ? <X className="size-3" strokeWidth={3} /> : null}
                  {running ? (
                    <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" />
                  ) : null}
                  {!done && !failed && !running ? at + 1 : null}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        role={state === "failed" ? "alert" : "status"}
        className="mt-12 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 gap-y-1.5 animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none"
      >
        {state === "failed" ? (
          <AlertTriangle
            aria-hidden
            className="mt-1 size-[18px] text-[var(--el-error)]"
          />
        ) : (
          <span className="mt-[3px]">
            {state === "running" ? (
              <Spinner />
            ) : (
              <span className="block size-[18px]" />
            )}
          </span>
        )}
        <span className="text-[17px] font-medium text-[var(--el-ink)]">
          {copy.title}
        </span>
        <p className="col-start-2 max-w-[54ch] text-sm leading-[23px] text-[var(--el-muted)]">
          {copy.body}
        </p>
        {requestAction}
      </div>

      <div className="mt-10 grid gap-2.5 border-t border-[var(--el-hairline)] pt-5">
        <span className="text-xs text-[var(--el-muted-soft)]">
          {t("outcomesTitle")}
        </span>
        <p className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[var(--el-muted)]">
          {(
            [
              "topics",
              "decisions",
              "tasks",
              "open",
              "replacements",
              "taskChanges",
            ] as const
          ).map((key) => (
            <span key={key}>{t(`outcomes.${key}`)}</span>
          ))}
        </p>
      </div>

      <p className="mt-10 text-[13px] text-[var(--el-muted)]">
        {t("transcriptReady")}{" "}
        <button
          type="button"
          className="text-[var(--el-ink)] underline underline-offset-[3px]"
          onClick={onOpenTranscript}
        >
          {t("openTranscript")}
        </button>
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="block size-[18px] shrink-0 animate-spin rounded-full border-2 border-[var(--el-hairline-strong)] border-t-[var(--el-ink)] motion-reduce:animate-none"
    />
  );
}
