"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetAnalysisFlowQueryOptions,
  useRequestAnalysis,
} from "@/lib/api/generated/analysis/analysis";
import { moveFlowStatus } from "@/lib/notes/review/flow-cache";

/** 후속 분석 요청이 저장되지 않은 경우도 기존 수동 요청 API에서 판정합니다. */
export function PendingAnalysisRetry({
  noteId,
  disabled,
}: {
  noteId: string;
  disabled: boolean;
}) {
  const queryClient = useQueryClient();
  const request = useRequestAnalysis({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);

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
            setMessage("분석을 요청했습니다.");
          }
        } catch (error) {
          if (errorCodeOf(error) !== "MEETING_ANALYSIS_CONFLICT") throw error;
          setMessage("분석이 진행 중이거나 요청 상태가 바뀌었습니다.");
        }
      }
      try {
        await refresh();
      } catch {
        setReadFailed(true);
        setMessage("분석 상태를 불러오지 못했습니다.");
      }
    } catch (error) {
      setMessage(errorMessageOf(error, "분석을 요청하지 못했습니다."));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <Button
        variant="outline"
        size="sm"
        loading={busy}
        disabled={disabled}
        onClick={() => void run(!readFailed)}
      >
        {readFailed ? "상태 다시 확인" : "분석 재요청"}
      </Button>
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
