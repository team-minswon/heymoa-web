"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf } from "@/lib/api/error-message";
import {
  useGetLatestAnalysis,
  useRequestAnalysis,
} from "@/lib/api/generated/analysis/analysis";
import type {
  AnalysisResultResponseData,
  AnalysisResultResponseDataRetry,
  AnalysisResultResponseDataSectionsItem,
  AnalysisResultResponseDataSectionsItemItemsItem,
  AnalysisResultResponseDataSectionsItemKind,
} from "@/lib/api/generated/models";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";
import { SpeakerNudgeBanner } from "@/components/notes/speaker-nudge-banner";

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

/**
 * 근거를 펼치고 접는 움직임. 레코더 독과 같은 값이다 — 같은 제품 면에서 열리고 닫히는
 * 것들이 저마다 다른 속도로 움직이면 화면이 한 물건으로 안 읽힌다.
 *
 * `bounce: 0` — 되튀면 「무언가 튀어나왔다」가 되는데, 여기서 자라는 것은 방금 누른 항목의
 * 근거다. 눌린 만큼만 열려야 한다.
 */
const EVIDENCE_TRANSITION = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.2,
};

/**
 * 폴링 중인 응답 봉투에서 **아직 도는 것이 있나**를 꺼낸다.
 *
 * **재요약이 돌 때가 함정이다.** 그때 본문은 마지막 성공본이라 `status`가 `SUCCEEDED`인데,
 * 실제로는 새 분석이 돌고 있다 (APP-421). `status`만 보면 폴링이 멈춰 다 만든 요약이
 * 새로고침 전까지 안 들어온다. 재요약 상태가 있으면 그쪽이 판정한다.
 */
function runningStatusOf(payload: unknown): string | null {
  const envelope = payload as
    | {
        status?: number;
        data?: {
          success?: boolean;
          data?: { status?: string; retry?: { status?: string } | null };
        };
      }
    | undefined;
  if (envelope?.status !== 200 || !envelope.data?.success) return null;
  const result = envelope.data.data;
  return result?.retry?.status ?? result?.status ?? null;
}

/** 아직 끝나지 않은 분석인가. 진행 표시와 폴링이 같은 판정을 쓴다. */
function isRunning(status: string | null | undefined): boolean {
  return status === "PENDING" || status === "RUNNING";
}

/**
 * 요약 탭. `GET analyses/latest` 하나가 다섯 화면을 만든다 — 404 빈 상태(오류 아님),
 * PENDING/RUNNING 분석 중(폴링), SUCCEEDED 항목 리스트, FAILED 재분석. 회의가 종료되기
 * 전에는 요약이 없으므로 안내만 보인다(요약 만들기는 ENDED에만 — 계약상 MEETING_NOT_ENDED 예방).
 *
 * **요약은 언제나 하나다.** 서버가 마지막 성공본을 본문으로 주고, 그보다 나중에 시도된
 * 재요약은 `retry`에 상태만 실려 온다 (APP-421). 그래서 다시 만들기를 눌러도 화면이
 * 비지 않고, 위에 한 줄(`RetryStrip`)만 붙는다.
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
      refetchInterval: (query) =>
        isRunning(runningStatusOf(query.state.data)) ? POLL_INTERVAL_MS : false,
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
  const isRequesting =
    requestAnalysis.isPending ||
    analysisQuery.isFetching ||
    isRunning(analysis?.retry?.status);
  const startAnalysis = () =>
    requestAnalysis.mutate(
      { noteId },
      { onSuccess: () => void analysisQuery.refetch() }
    );

  /**
   * **조회와 분석은 다른 기다림이다.** 둘 다 `AnalyzingSkeleton` 하나로 그렸는데, 그 화면의
   * 문구가 「회의를 정리하고 있습니다 · 다른 화면으로 옮겨도 됩니다」였다 — 수백 ms 조회에
   * 붙으면 거짓말이고, 반대로 몇 분 걸리는 분석에 skeleton을 쓰면 「곧 이 자리에 들어찬다」는
   * 약속이 거짓이 된다.
   *
   * 조회는 곧 이 자리를 채우니 skeleton, 분석은 끝나는 시각을 모르니 진행 표시다.
   */
  if (analysisQuery.isLoading) {
    return <SummaryFetchSkeleton />;
  }

  if (analysis?.status === "PENDING" || analysis?.status === "RUNNING") {
    return <AnalyzingProgress />;
  }

  if (analysis?.status === "SUCCEEDED") {
    return (
      <>
        <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-5">
          <SpeakerNudgeBanner noteId={noteId} />
          {analysis.retry ? (
            <RetryStrip
              retry={analysis.retry}
              onRetry={startAnalysis}
              isRetrying={isRequesting}
            />
          ) : null}
          {/* **조건 없이 늘 같은 자리에 있다.** 예전에는 화자 상태에 따라 문구와 버튼이
              바뀌는 배너였는데, 언제 눌러야 하는지가 화면마다 달라 읽는 일이 됐다.
              다시 만들 이유는 화자만이 아니다 — 전사를 고쳤거나 그냥 다시 보고 싶을 때도
              같은 버튼이면 찾을 것이 없다. */}
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-[30px]"
              loading={isRequesting}
              onClick={startAnalysis}
            >
              요약 다시 만들기
            </Button>
          </div>
        </div>
        <SummarySections
          analysis={analysis}
          onEvidenceSelect={onEvidenceSelect}
        />
      </>
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

/** 섹션마다 흔한 항목 수와 길이. 전부 같은 폭이면 항목 리스트가 아니라 블록으로 보인다. */
const SUMMARY_SKELETON_WIDTHS: Record<string, string[]> = {
  OVERVIEW: ["78%", "54%"],
  ACTION_ITEM: ["64%", "82%", "47%"],
  DECISION: ["71%", "58%"],
};

/**
 * 요약 **조회** 스켈레톤. 곧 이 자리를 채울 데이터를 기다리므로 최종 화면
 * (`SummarySections`)과 같은 뼈대를 그린다 — 섹션 제목 + 밑줄, 그 아래 항목 줄.
 *
 * **섹션 제목은 가리지 않는다.** 개요·액션 아이템·결정 셋은 응답이 아니라 고정된 순서다
 * (`SECTION_ORDER`). 회색 막대로 덮으면 기하만 어긋나고 얻는 것이 없다.
 */
function SummaryFetchSkeleton() {
  return (
    <Shell>
      <div className="space-y-14" aria-label="요약 불러오는 중">
        {SECTION_ORDER.map((kind) => (
          <section key={kind}>
            <div className="flex items-baseline justify-between gap-4 border-b border-[var(--el-hairline-strong)] pb-2">
              <h2 className="font-serif text-xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
                {SECTION_LABELS[kind]}
              </h2>
            </div>
            <div className="mt-5 space-y-5">
              {(SUMMARY_SKELETON_WIDTHS[kind] ?? []).map((width, row) => (
                // 실제 항목은 15px·leading-7이라 한 줄이 28이다.
                <Skeleton
                  key={row}
                  className="h-7 rounded-chip"
                  style={{ width }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}

/**
 * 분석 **진행** 표시. **skeleton이 아니다** — 분석은 몇 분이 걸리므로 「곧 이 자리에
 * 들어찬다」는 skeleton의 약속이 성립하지 않는다. 끝나는 시각을 모르는 기다림은 진행
 * 표시와 「왜 기다리는지」 한 줄로 그린다.
 *
 * 상자 모양은 같은 탭의 다른 안내(요약 없음·분석 실패)와 같다 — 같은 자리에 서는 것들이
 * 저마다 다르게 생기면 무엇이 상태이고 무엇이 내용인지 읽히지 않는다.
 */
function AnalyzingProgress() {
  return (
    <Shell>
      <div
        role="status"
        className="rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-5"
      >
        <div className="flex items-center gap-2.5">
          <Loader2
            aria-hidden
            className="size-4 shrink-0 animate-spin text-[var(--el-muted)]"
          />
          <p className="text-sm font-medium text-[var(--el-ink)]">
            회의를 정리하고 있습니다
          </p>
        </div>
        {/* 분석은 몇 분이 걸린다 — 여기 붙들려 기다릴 필요가 없다는 것을 말해 준다. */}
        <p className="mt-1.5 pl-[26px] text-xs leading-relaxed text-[var(--el-muted)]">
          다른 화면으로 옮겨도 됩니다. 정리가 끝나면 이 탭에 나타납니다.
        </p>
      </div>
    </Shell>
  );
}

/**
 * 요약 위에 붙는 **재요약 한 줄**.
 *
 * 요약은 언제나 마지막 성공본 하나다 (APP-421). 재요약을 걸어도 아래 요약은 그대로 있고
 * 이 줄만 바뀐다 — **화면이 비지 않는 것이 요점이다.** 진행 중이면 지금 무엇이 도는지,
 * 실패했으면 아래 요약이 그 전 것임을 말해 준다.
 *
 * `AnalyzingProgress`와 달리 상자를 얇게 쓴다. 그쪽은 화면 전체가 그것뿐이고 여기는
 * 요약 위에 얹히는 알림이라, 같은 무게로 그리면 요약보다 먼저 읽힌다.
 */
function RetryStrip({
  retry,
  onRetry,
  isRetrying,
}: {
  retry: NonNullable<AnalysisResultResponseDataRetry>;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  if (retry.status === "FAILED") {
    return (
      <div
        role="alert"
        className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] px-3 py-2.5"
      >
        <AlertTriangle
          aria-hidden
          className="size-4 shrink-0 text-[var(--el-error)]"
        />
        <p className="text-xs leading-relaxed text-[var(--el-ink)]">
          요약을 다시 만들지 못했습니다. 아래는 그 전에 만든 요약입니다.
          <span className="text-[var(--el-muted)]">
            {retry.errorMessage ? ` ${retry.errorMessage}` : null}
            {retry.errorCode ? ` (${retry.errorCode})` : null}
          </span>
        </p>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-[26px]"
          disabled={isRetrying}
          onClick={onRetry}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mt-3 flex items-center gap-2.5 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-3 py-2.5"
    >
      <Loader2
        aria-hidden
        className="size-4 shrink-0 animate-spin text-[var(--el-muted)]"
      />
      <p className="text-xs leading-relaxed text-[var(--el-ink)]">
        요약을 다시 만들고 있습니다.
        <span className="text-[var(--el-muted)]">
          {" 끝나면 아래 요약이 새것으로 바뀝니다."}
        </span>
      </p>
    </div>
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
      <div className="space-y-14">
        {SECTION_ORDER.map((kind) => {
          const items = byKind.get(kind)?.items ?? [];
          return (
            <section key={kind} aria-label={SECTION_LABELS[kind]}>
              {/* 개수는 장식이 아니라 훑기 위한 것이다 — 액션이 16개인지 2개인지가
                  스크롤하기 전에 보여야 어디를 읽을지 정한다. */}
              <div className="flex items-baseline justify-between gap-4 border-b border-[var(--el-hairline-strong)] pb-2">
                <h2 className="font-serif text-xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
                  {SECTION_LABELS[kind]}
                </h2>
                {items.length ? (
                  <span className="font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                    {items.length}
                  </span>
                ) : null}
              </div>
              {items.length ? (
                <ul className="mt-5 space-y-5">
                  {items.map((item) => (
                    <SummaryItem
                      key={item.itemId}
                      item={item}
                      kind={kind}
                      onEvidenceSelect={onEvidenceSelect}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-sm text-[var(--el-muted)]">
                  이 회의에서는 나오지 않았습니다.
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
 * 항목 한 줄과 그 근거.
 *
 * **근거 마커는 문장 바로 뒤에 붙는다.** 오른쪽 끝으로 밀면 820px 폭에서 문장과 마커가
 * 600px 떨어져 무엇의 근거인지 안 보인다. 각주가 인쇄물에서 이미 푼 문제이고, 이 제품의
 * 논지("주장 + 출처")가 정확히 각주의 구조다.
 *
 * **접힘이 기본이다** — 인용까지 펼쳐 두면 항목 리스트가 다시 긴 글이 되어 훑을 수 없다.
 * 근거가 0개인 항목에는 마커를 달지 않는다(계약상 정상이고, 빈 마커는 누를 것이 없다).
 */
function SummaryItem({
  item,
  kind,
  onEvidenceSelect,
}: {
  item: AnalysisResultResponseDataSectionsItemItemsItem;
  kind: AnalysisResultResponseDataSectionsItemKind;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const evidenceId = `evidence-${item.itemId}`;
  // 개요는 회의를 서술하는 문단이고 액션·결정은 행 단위 항목이다. 성격이 다르니 모양도
  // 다르게 둔다 — 셋을 같은 목록으로 그리면 30줄이 전부 같은 무게가 된다.
  const isProse = kind === "OVERVIEW";
  const hasEvidence = item.evidence.length > 0;

  const claim = (
    <>
      {item.content}
      {hasEvidence ? (
        <>
          {/* 마커는 그림이라 `aria-hidden`이다. 개수는 화면에만 남고 스크린리더에서
              사라지므로 여기서 말로 준다 — 몇 개인지가 펼칠지 말지의 근거다. */}
          <span className="sr-only">{` 근거 ${item.evidence.length}개`}</span>
        </>
      ) : null}
      {hasEvidence ? (
        <span
          aria-hidden
          /* 각주 마커. 컨트롤은 줄 전체이므로 여기는 상태 표시만 한다. */
          className={cn(
            "ml-1.5 inline-flex translate-y-[-1px] items-center gap-0.5 rounded-chip px-1.5 py-0.5 align-baseline font-mono text-[11px] tabular-nums transition-colors",
            open
              ? "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
              : "text-[var(--el-muted-soft)] group-hover/claim:bg-[var(--el-surface-strong)] group-hover/claim:text-[var(--el-ink)]"
          )}
        >
          {item.evidence.length}
          <ChevronDown
            className={cn("size-3 transition-transform", open && "rotate-180")}
          />
        </span>
      ) : null}
    </>
  );

  return (
    <li className={cn(!isProse && "relative pl-4")}>
      {!isProse ? (
        <span
          aria-hidden
          className="absolute left-0 top-[11px] size-1 rounded-full bg-[var(--el-hairline-strong)]"
        />
      ) : null}
      {hasEvidence ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={evidenceId}
          /* **누를 자리는 마커가 아니라 줄 전체다.** 마커만 컨트롤이면 28px 타깃 옆의
             문장 전체가 죽은 영역이 된다.

             **선택은 살려 둔다** — 요약은 복사해 가는 글이다. 드래그로 글자를 집은
             뒤의 mouseup도 click이라, 선택이 남아 있으면 펼치지 않는다.

             **그 방어는 포인터에만 건다.** 키보드 Space·Enter가 만드는 click은
             `detail === 0`이고, 선택을 남긴 채 포커스를 옮겨 온 사람은 그것으로도
             못 펼치게 된다. */
          onClick={(event) => {
            const byPointer = event.detail > 0;
            if (byPointer && !window.getSelection()?.isCollapsed) return;
            setOpen((current) => !current);
          }}
          className="group/claim -mx-2 block w-full select-text rounded-block px-2 py-0.5 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
        >
          <span className="block break-keep text-[15px] leading-7 text-[var(--el-ink)]">
            {claim}
          </span>
        </button>
      ) : (
        <p className="break-keep text-[15px] leading-7 text-[var(--el-ink)]">
          {claim}
        </p>
      )}
      {/* **펼침은 높이가 자라는 일이다.** 그냥 마운트하면 근거 서너 줄이 한 프레임에
          튀어나와 아래 항목들을 통째로 밀어 내려서, 무엇이 새로 생겼고 읽던 줄이 어디로
          갔는지 눈이 못 따라간다. 200ms 동안 자라면 그 이동이 이어져 보인다.

          **높이는 바깥 껍데기가 갖는다.** `<ul>`에 직접 걸면 `height: 0`에서도 `mt-3`과
          왼쪽 세로선이 남아 접힌 자리에 3px 짜리 선 토막이 선다. `overflow-hidden` 껍데기가
          BFC를 세워 그 여백까지 함께 잘라 낸다.

          `initial={false}` — 이미 펼쳐진 채로 다시 보이는 경우(요약 탭이 마운트를 유지한다)
          까지 애니메이션하면 탭을 돌아올 때마다 전부 다시 자란다. */}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="evidence"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : EVIDENCE_TRANSITION}
            className="overflow-hidden"
          >
            <ul
              id={evidenceId}
              className="mt-3 space-y-2 border-l border-[var(--el-hairline-strong)] pl-4"
            >
              {item.evidence.map((evidence) => (
                <li key={evidence.segmentId}>
                  {/* 누르면 전사의 그 줄로 간다. **`segmentId`로만 찾는다** — `startedAtMs`는
                  세션별 오프셋이라 세션이 둘 이상이면 화면의 시각과 어긋난다(APP-398). */}
                  <button
                    type="button"
                    onClick={() => onEvidenceSelect(evidence.segmentId)}
                    /* **여백은 음수 마진으로 낸다.** hover 배경이 글자에 딱 붙어 있어서 짚을
                   자리처럼 보이지 않았는데, 그냥 `px-2`를 주면 인용문만 오른쪽으로 밀려
                   위 항목과 줄이 안 맞는다. 안쪽으로 넓히고 밖으로 같은 만큼 당긴다. */
                    className="group -mx-2 flex w-full items-baseline gap-2 rounded-block px-2 py-1 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
                  >
                    <span className="min-w-0 break-keep font-serif text-[15px] leading-7 text-[var(--el-body)]">
                      {evidence.text}
                    </span>
                    <span
                      aria-hidden
                      className="min-w-0 flex-1 translate-y-[-4px] border-b border-dotted border-[var(--el-hairline)]"
                    />
                    <time className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-muted)]">
                      {formatOffset(evidence.startedAtMs)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
