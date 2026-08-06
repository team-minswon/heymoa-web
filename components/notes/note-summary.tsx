"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf } from "@/lib/api/error-message";
import {
  useGetLatestAnalysis,
  useRequestAnalysis,
} from "@/lib/api/generated/analysis/analysis";
import type {
  AnalysisResultResponseData,
  AnalysisResultResponseDataSectionsItem,
  AnalysisResultResponseDataSectionsItemItemsItem,
  AnalysisResultResponseDataSectionsItemKind,
} from "@/lib/api/generated/models";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

/**
 * 섹션 이름과 순서. 서버도 같은 순서로 내려주지만 여기서 한 번 더 세운다 — 한 섹션이
 * 통째로 비어 응답에서 빠져도 헤딩 셋은 남아야 "그 칸이 비었다"와 "그 칸이 없다"가
 * 구분된다.
 */
const SECTION_LABELS: Record<
  AnalysisResultResponseDataSectionsItemKind,
  string
> = {
  OVERVIEW: "개요",
  ACTION_ITEM: "액션 아이템",
  DECISION: "결정",
};

const SECTION_ORDER = Object.keys(
  SECTION_LABELS
) as AnalysisResultResponseDataSectionsItemKind[];

const POLL_INTERVAL_MS = 3_000;

/** 폴링 중인 응답 봉투에서 분석 상태만 꺼낸다 — PENDING/RUNNING일 때만 계속 당긴다. */
function statusOf(payload: unknown): string | null {
  const envelope = payload as
    | {
        status?: number;
        data?: { success?: boolean; data?: { status?: string } };
      }
    | undefined;
  if (envelope?.status !== 200 || !envelope.data?.success) return null;
  return envelope.data.data?.status ?? null;
}

/**
 * 요약 탭. `GET analyses/latest` 하나가 다섯 화면을 만든다 — 404 빈 상태(오류 아님),
 * PENDING/RUNNING 분석 중(폴링), SUCCEEDED 항목 리스트, FAILED 재분석. 회의가 종료되기
 * 전에는 요약이 없으므로 안내만 보인다(요약 만들기는 ENDED에만 — 계약상 MEETING_NOT_ENDED 예방).
 */
export function NoteSummary({
  noteId,
  isEnded,
  onEvidenceSelect,
}: {
  noteId: string;
  isEnded: boolean;
  /** 근거 인용을 눌렀다. 소유자가 전사 탭으로 옮기고 그 줄을 짚는다. */
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const analysisQuery = useGetLatestAnalysis(noteId, {
    query: {
      retry: false,
      // 진행 중인 분석만 폴링한다. 404·실패는 종료 순간의 refetch(아래 effect)와 수동
      // 액션(요약 만들기·다시 시도)이 맡는다 — 없는 분석을 3초마다 무한히 두드리지 않는다.
      refetchInterval: (query) => {
        const status = statusOf(query.state.data);
        return status === "PENDING" || status === "RUNNING"
          ? POLL_INTERVAL_MS
          : false;
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
    return (
      <SummarySections
        analysis={analysis}
        onEvidenceSelect={onEvidenceSelect}
      />
    );
  }

  if (analysis?.status === "FAILED") {
    return (
      <Shell>
        <div
          role="alert"
          className="rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-4"
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
        <div className="rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-5">
          <p className="text-sm font-medium text-[var(--el-ink)]">
            {isEnded
              ? "아직 요약이 없습니다"
              : "요약은 회의가 끝나면 생성됩니다"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--el-muted)]">
            {isEnded
              ? "이 회의의 요약을 만들어 개요·액션 아이템·결정을 정리합니다."
              : "회의를 종료하면 개요·액션 아이템·결정이 자동으로 정리됩니다."}
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
        <p className="text-sm text-[var(--el-ink)]">
          요약을 불러오지 못했습니다.
        </p>
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
    <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pb-16 pt-6">
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
      {/* 분석은 몇 분이 걸린다 — 여기 붙들려 기다릴 필요가 없다는 것을 말해 준다. */}
      <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
        다른 화면으로 옮겨도 됩니다. 정리가 끝나면 이 탭에 나타납니다.
      </p>
      <div className="mt-6 space-y-6" aria-label="분석 진행 중">
        {SECTION_ORDER.map((kind) => (
          <div key={kind} className="space-y-2">
            <p className="text-xs font-medium text-[var(--el-muted)]">
              {SECTION_LABELS[kind]}
            </p>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/**
 * 개요 → 액션 아이템 → 결정을 한 화면에 위에서 아래로 낸다. 탭으로 가르지 않는 이유는
 * 셋을 오가며 눌러야 회의 하나를 파악할 수 있게 되기 때문이다 — 제목이 경계를 만드니
 * 스크롤로 족하다.
 *
 * **본문은 마크다운 덩어리가 아니라 항목 리스트다.** 항목마다 그 항목이 나온 전사 줄이
 * 붙는다(설계 §heymoa-web). 예전 주석이 "요약은 끝까지 읽는 글"이라고 적었는데, 그 판정은
 * 이 개편이 뒤집었다 — 읽는 글이면 근거를 매달 자리가 없다.
 */
function SummarySections({
  analysis,
  onEvidenceSelect,
}: {
  analysis: AnalysisResultResponseData;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const byKind = new Map<string, AnalysisResultResponseDataSectionsItem>(
    analysis.sections.map((section) => [section.kind, section])
  );
  return (
    <Shell>
      <div className="space-y-8">
        {SECTION_ORDER.map((kind) => {
          const items = byKind.get(kind)?.items ?? [];
          return (
            <section key={kind} aria-label={SECTION_LABELS[kind]}>
              <h2 className="border-b border-[var(--el-hairline-strong)] pb-2 font-serif text-xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
                {SECTION_LABELS[kind]}
              </h2>
              {items.length ? (
                <ul className="mt-3">
                  {items.map((item) => (
                    <SummaryItem
                      key={item.itemId}
                      item={item}
                      onEvidenceSelect={onEvidenceSelect}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--el-muted)]">
                  내용이 없습니다.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </Shell>
  );
}

/**
 * 항목 한 줄과 그 근거. **근거는 접힘이 기본이다** — 인용까지 펼쳐 두면 항목 리스트가 다시
 * 긴 글이 되어 한눈에 훑을 수 없다. 근거가 0개인 항목에는 칩을 달지 않는다(계약상 정상이고,
 * 빈 칩은 누를 것이 없는 컨트롤이 된다).
 */
function SummaryItem({
  item,
  onEvidenceSelect,
}: {
  item: AnalysisResultResponseDataSectionsItemItemsItem;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const evidenceId = `evidence-${item.itemId}`;
  return (
    <li className="border-b border-[var(--el-hairline)] py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 break-keep text-[15px] leading-7 text-[var(--el-ink)]">
          {item.content}
        </p>
        {item.evidence.length ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={evidenceId}
            onClick={() => setOpen((current) => !current)}
            className="mt-0.5 flex shrink-0 items-center gap-1 rounded-chip border border-[var(--el-hairline)] px-2 py-1 text-[11px] font-medium text-[var(--el-muted)] transition-colors hover:border-[var(--el-hairline-strong)] hover:text-[var(--el-ink)]"
          >
            근거 {item.evidence.length}
            <ChevronDown
              aria-hidden
              className={cn("size-3 transition-transform", open && "rotate-180")}
            />
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          id={evidenceId}
          className="mt-2 space-y-1 border-l-2 border-[var(--el-hairline-strong)] pl-3"
        >
          {item.evidence.map((evidence) => (
            <li key={evidence.segmentId}>
              {/* 누르면 전사의 그 줄로 간다. **`segmentId`로만 찾는다** — `startedAtMs`는
                  세션별 오프셋이라 세션이 둘 이상이면 화면의 시각과 어긋난다(APP-398). */}
              <button
                type="button"
                onClick={() => onEvidenceSelect(evidence.segmentId)}
                className="flex w-full items-baseline justify-between gap-3 rounded-chip px-1 py-1 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
              >
                <span className="min-w-0 break-keep text-[13px] leading-6 text-[var(--el-body)]">
                  “{evidence.text}”
                </span>
                <time className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                  {formatOffset(evidence.startedAtMs)}
                </time>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
