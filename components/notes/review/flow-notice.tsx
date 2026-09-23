"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, LoaderCircle, X } from "lucide-react";

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

const STEPS = ["화자 나누기", "분석", "검토", "확정"] as const;

/** 흐름 상태 → 지금 선 단계와 그 단계의 모양. */
const CURRENT: Record<
  WaitingStatus,
  { index: number; state: "running" | "waiting" | "failed" }
> = {
  DIARIZING: { index: 0, state: "running" },
  NOT_REQUESTED: { index: 1, state: "waiting" },
  ANALYZING: { index: 1, state: "running" },
  ANALYSIS_FAILED: { index: 1, state: "failed" },
};

const COPY: Record<WaitingStatus, { title: string; body: string }> = {
  DIARIZING: {
    title: "화자를 나누는 중입니다",
    body: "끝나면 바로 회의 분석을 시작합니다. 몇 분 걸릴 수 있고, 다른 화면으로 옮겨도 됩니다.",
  },
  NOT_REQUESTED: {
    title: "분석을 기다리고 있습니다",
    body: "스크립트가 모두 저장되면 분석을 시작합니다. 오래 걸리면 직접 요청할 수 있습니다.",
  },
  ANALYZING: {
    title: "회의를 분석하는 중입니다",
    body: "결정과 할 일을 주제로 묶고, 담당과 기한을 붙이고, 프로젝트의 기존 결정 · 할 일과 견줍니다. 몇 분 걸릴 수 있고, 다른 화면으로 옮겨도 됩니다.",
  },
  ANALYSIS_FAILED: {
    title: "회의를 분석하지 못했습니다",
    body: "스크립트와 회의 기록은 그대로 남아 있습니다.",
  },
};

export function isWaitingStatus(status: FlowStatus): status is WaitingStatus {
  return status in CURRENT;
}

/**
 * 검토본이 서기 전의 요약 탭. 끝나는 시각을 모르는 서버 작업이라 skeleton 이 아니라
 * 진행 표시와 왜 기다리는지 한 줄로 그린다. 재요청은 노트 멤버 누구나 할 수 있다.
 */
export function FlowNotice({
  noteId,
  status,
  onOpenTranscript,
}: {
  noteId: string;
  status: WaitingStatus;
  onOpenTranscript: () => void;
}) {
  const queryClient = useQueryClient();
  const request = useRequestAnalysis();
  const { index, state } = CURRENT[status];
  const copy = COPY[status];
  const canRequest = status === "ANALYSIS_FAILED" || status === "NOT_REQUESTED";

  return (
    <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-10 pb-16">
      <ol
        aria-label="분석 단계"
        className="flex flex-wrap items-center gap-2.5 text-xs"
      >
        {STEPS.map((label, at) => {
          const done = at < index;
          const now = at === index;
          const failed = now && state === "failed";
          const running = now && state === "running";
          const stepState = done
            ? "완료"
            : failed
              ? "실패"
              : running
                ? "진행 중"
                : "대기";
          return (
            <li
              key={label}
              aria-label={`${label}: ${stepState}`}
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
        <p className="col-start-2 max-w-[54ch] text-sm leading-[23px] break-keep text-[var(--el-muted)]">
          {copy.body}
        </p>
        {canRequest ? (
          <div className="col-start-2 mt-3">
            <Button
              size="sm"
              loading={request.isPending}
              onClick={() =>
                request.mutate(
                  { noteId },
                  {
                    /**
                     * **서버가 준 상태를 쓴다** (APP-685). 전에는 `"ANALYZING"` 을 추측해 캐시에
                     * 써 넣고 폴링이 따라오기를 기다렸다 — 추측이 틀리면 버튼이 잠깐 거짓을
                     * 말한다. 202 응답이 **요청을 보낸 뒤의** 흐름 상태를 싣는다.
                     */
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
              {status === "ANALYSIS_FAILED" ? "다시 분석" : "분석 요청"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-10 grid gap-2.5 border-t border-[var(--el-hairline)] pt-5">
        <span className="text-xs text-[var(--el-muted-soft)]">
          분석이 끝나면 보이는 것
        </span>
        <p className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[var(--el-muted)]">
          {[
            "주제 요약",
            "결정",
            "할 일 · 담당과 기한",
            "이슈 · 질문",
            "이전 결정 대체",
            "기존 할 일 변경",
          ].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </p>
      </div>

      <p className="mt-10 text-[13px] text-[var(--el-muted)]">
        스크립트는 지금 볼 수 있습니다.{" "}
        <button
          type="button"
          className="text-[var(--el-ink)] underline underline-offset-[3px]"
          onClick={onOpenTranscript}
        >
          스크립트 보기
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
