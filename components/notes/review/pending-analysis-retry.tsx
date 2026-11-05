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

/** 후속 분석 요청이 저장되지 않은 경우도 기존 수동 요청 API에서 판정합니다. */
export function PendingAnalysisRetry({
  noteId,
  retryable,
  flowUpdatedAt,
  disabled,
}: {
  noteId: string;
  /** 서버가 지금 다시 받는지. 거짓이면 재요청 버튼은 없고, 조회 실패 뒤의 「상태 다시 확인」만 남는다. */
  retryable: boolean;
  /** 흐름 조회가 마지막으로 성공한 시각. 이 값이 바뀌면 지난 조회 실패·요청 안내는 낡은 말이다. */
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
  // 요청·확인이 끝난 뒤 폴링이 흐름을 새로 읽으면 지난 안내를 걷는다(렌더 중 상태 조정). 시각이 앞으로 갈 때만
  // 본다 — 부모가 옛 시각으로 한 번 더 그려도 걷지 않는다. 진행 중의 재조회는 그 요청 자신의 것이라 둔다
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
      // 이 요청 자신의 재조회까지는 이미 본 것으로 친다. 걷는 것은 그 뒤의 조회다
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
