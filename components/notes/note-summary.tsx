"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf } from "@/lib/api/error-message";
import {
  useGetLatestAnalysis,
  useRequestAnalysis,
} from "@/lib/api/generated/analysis/analysis";
import type { AnalysisResultResponseData } from "@/lib/api/generated/models";
import { renderMarkdown } from "@/lib/markdown/render-markdown";

const POLL_INTERVAL_MS = 3_000;

/** 폴링 중인 응답 봉투에서 분석 상태만 꺼낸다 — PENDING/RUNNING일 때만 계속 당긴다. */
function statusOf(payload: unknown): string | null {
  const envelope = payload as
    | { status?: number; data?: { success?: boolean; data?: { status?: string } } }
    | undefined;
  if (envelope?.status !== 200 || !envelope.data?.success) return null;
  return envelope.data.data?.status ?? null;
}

/**
 * 요약 탭. `GET analyses/latest` 하나가 다섯 화면을 만든다 — 404 빈 상태(오류 아님),
 * PENDING/RUNNING 분석 중(폴링), SUCCEEDED 마크다운 3종, FAILED 재분석. 회의가 종료되기
 * 전에는 요약이 없으므로 안내만 보인다(요약 만들기는 ENDED에만 — 계약상 MEETING_NOT_ENDED 예방).
 */
export function NoteSummary({
  noteId,
  isEnded,
}: {
  noteId: string;
  isEnded: boolean;
}) {
  const analysisQuery = useGetLatestAnalysis(noteId, {
    query: {
      retry: false,
      // 진행 중인 분석만 폴링한다. 404·실패는 종료 순간의 refetch(아래 effect)와 수동
      // 액션(요약 만들기·다시 시도)이 맡는다 — 없는 분석을 3초마다 무한히 두드리지 않는다.
      refetchInterval: (query) => {
        const status = statusOf(query.state.data);
        return status === "PENDING" || status === "RUNNING" ? POLL_INTERVAL_MS : false;
      },
    },
  });
  const requestAnalysis = useRequestAnalysis();

  // 회의가 (다른 참가자에 의해) 종료된 순간 곧바로 다시 읽는다 — 폴링 간격을 기다리지 않게.
  const refetch = analysisQuery.refetch;
  const wasEndedRef = useRef(isEnded);
  useEffect(() => {
    if (isEnded && !wasEndedRef.current) void refetch();
    wasEndedRef.current = isEnded;
  }, [isEnded, refetch]);

  const response = analysisQuery.data;
  const analysis =
    response !== undefined && response.status === 200 && response.data.success
      ? response.data.data
      : null;
  const isMissing =
    errorCodeOf(analysisQuery.error) === "ANALYSIS_JOB_NOT_FOUND";

  // 202 뒤 refetch가 도착하기 전까지 낡은 FAILED/404가 남고, mutation은 이미 끝나 버튼이 다시
  // 열린다 — 그 창에서 또 누르면 ANALYSIS_IN_PROGRESS(409)다. refetch가 끝날 때까지 함께 잠근다.
  const isRequesting = requestAnalysis.isPending || analysisQuery.isFetching;
  const startAnalysis = () =>
    requestAnalysis.mutate(
      { noteId },
      { onSuccess: () => void analysisQuery.refetch() }
    );

  if (analysisQuery.isLoading) {
    return <AnalyzingSkeleton />;
  }

  if (analysis?.status === "PENDING" || analysis?.status === "RUNNING") {
    return <AnalyzingSkeleton />;
  }

  if (analysis?.status === "SUCCEEDED") {
    return <SummarySections analysis={analysis} />;
  }

  if (analysis?.status === "FAILED") {
    return (
      <Shell>
        <div
          role="alert"
          className="rounded-2xl border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-4"
        >
          <div className="flex gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--el-ink)]">
                분석에 실패했습니다
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--el-muted)]">
                {analysis.errorMessage ?? "분석을 완료하지 못했습니다."}
                {analysis.errorCode ? ` (${analysis.errorCode})` : null}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-[30px]"
                disabled={isRequesting}
                onClick={startAnalysis}
              >
                다시 분석
              </Button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // 404(분석 없음) 또는 다른 실패.
  if (isMissing) {
    return (
      <Shell>
        <div className="rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-5">
          <p className="text-sm font-medium text-[var(--el-ink)]">
            {isEnded ? "아직 요약이 없습니다" : "요약은 회의가 끝나면 생성됩니다"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--el-muted)]">
            {isEnded
              ? "이 회의의 요약을 만들어 개요·액션 아이템·인사이트를 정리합니다."
              : "회의를 종료하면 개요·액션 아이템·인사이트가 자동으로 정리됩니다."}
          </p>
          {isEnded ? (
            <Button
              size="sm"
              className="mt-3 h-[30px]"
              disabled={isRequesting}
              onClick={startAnalysis}
            >
              요약 만들기
            </Button>
          ) : null}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div role="alert" className="space-y-2">
        <p className="text-sm text-[var(--el-ink)]">요약을 불러오지 못했습니다.</p>
        <Button
          variant="outline"
          size="sm"
          className="h-[30px]"
          onClick={() => void analysisQuery.refetch()}
        >
          다시 시도
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pt-7 pb-16 sm:px-9 sm:pt-9">
      {children}
    </div>
  );
}

function AnalyzingSkeleton() {
  return (
    <Shell>
      {/* v5: 대문자 키커 제거 — 세리프 제목만 유지(FORM SPEC). */}
      <h2 className="font-serif text-section font-light tracking-[-0.025em] text-[var(--el-ink)]">
        회의를 정리하고 있습니다
      </h2>
      <div className="mt-6 space-y-6" aria-label="분석 진행 중">
        {["개요", "액션 아이템", "인사이트"].map((label) => (
          <div key={label} className="space-y-2">
            <p className="text-xs font-medium text-[var(--el-muted)]">{label}</p>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

function SummarySections({
  analysis,
}: {
  analysis: AnalysisResultResponseData;
}) {
  const sections = [
    { label: "개요", body: analysis.overview },
    { label: "액션 아이템", body: analysis.actionItems },
    { label: "인사이트", body: analysis.insights },
  ];
  return (
    <Shell>
      <div className="space-y-8">
        {sections.map(({ label, body }) => (
          <section key={label} aria-label={label}>
            <h2 className="border-b border-[var(--el-hairline-strong)] pb-2 font-serif text-xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
              {label}
            </h2>
            <div className="mt-3 space-y-3">
              {body ? (
                renderMarkdown(body)
              ) : (
                <p className="text-sm text-[var(--el-muted)]">내용이 없습니다.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
