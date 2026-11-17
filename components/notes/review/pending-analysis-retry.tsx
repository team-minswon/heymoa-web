"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetAnalysisFlowQueryOptions,
  useRequestAnalysis,
} from "@/lib/api/generated/analysis/analysis";
import { moveFlowStatus } from "@/lib/notes/review/flow-cache";

export function PendingAnalysisRetry({
  noteId,
  retryable,
  flowUpdatedAt,
  disabled,
}: {
  noteId: string;
  retryable: boolean;
  flowUpdatedAt: number;
  disabled: boolean;
}) {
  const t = useTranslations("notes.review.retry");
  const queryClient = useQueryClient();
  const request = useRequestAnalysis({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [seenUpdatedAt, setSeenUpdatedAt] = useState(flowUpdatedAt);
  if (!busy && flowUpdatedAt > seenUpdatedAt) {
    setSeenUpdatedAt(flowUpdatedAt);
    if (readFailed) setReadFailed(false);
    if (message) setMessage(null);
  }

  const refresh = async () => {
    const options = getGetAnalysisFlowQueryOptions(noteId);
    await queryClient.cancelQueries({ queryKey: options.queryKey });
    await queryClient.fetchQuery({ ...options, staleTime: 0 });
  };
  const run = async (requestAgain: boolean) => {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setReadFailed(false);
    setMessage(null);
    try {
      if (requestAgain) {
        try {
          const response = await request.mutateAsync({ noteId });
          if (response.status === 202 && response.data.success) {
            moveFlowStatus(queryClient, noteId, response.data.data.flowStatus);
            setMessage(t("requested"));
          }
        } catch (error) {
          if (errorCodeOf(error) !== "MEETING_ANALYSIS_CONFLICT") throw error;
          setMessage(t("conflict"));
        }
      }
      try {
        await refresh();
      } catch {
        setReadFailed(true);
        setMessage(t("readFailed"));
      }
    } catch (error) {
      setMessage(errorMessageOf(error, t("requestFailed")));
    } finally {
      setSeenUpdatedAt(
        queryClient.getQueryState(
          getGetAnalysisFlowQueryOptions(noteId).queryKey
        )?.dataUpdatedAt ?? flowUpdatedAt
      );
      lock.current = false;
      setBusy(false);
    }
  };

  const showButton = retryable || readFailed;
  if (!showButton && !message) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      {showButton ? (
        <Button
          variant="outline"
          size="sm"
          loading={busy}
          disabled={disabled}
          onClick={() => void run(!readFailed)}
        >
          {readFailed ? t("recheck") : t("requestAgain")}
        </Button>
      ) : null}
      {message ? (
        <p
          role={readFailed || request.isError ? "alert" : "status"}
          className="text-xs text-[var(--el-muted)]"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
