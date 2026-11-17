"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

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
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";
import type { TranscriptResponseDataSegmentsItem } from "@/lib/api/generated/models";
import { segmentsById } from "@/lib/notes/review/moments";
import { formatOffset } from "@/lib/transcription/presentation";
import { SECTION_ORDER } from "@/lib/notes/analysis-sections";
import { CopyMarkdownButton } from "@/components/notes/copy-markdown-button";
import { summaryToMarkdown, type NoteMeta } from "@/lib/notes/copy-markdown";
import { cn } from "@/lib/utils";
import { SpeakerNudgeBanner } from "@/components/notes/speaker-nudge-banner";
import { useSummaryViewed } from "@/lib/analytics/use-summary-viewed";
import { useEventStreamHealthy } from "@/lib/events/health";
import { hintedInterval } from "@/lib/events/interval";

const POLL_INTERVAL_MS = 3_000;

const EVIDENCE_TRANSITION = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.2,
};

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

function isRunning(status: string | null | undefined): boolean {
  return status === "PENDING" || status === "RUNNING";
}

export function NoteSummary({
  noteId,
  workspaceId,
  isEnded,
  noteMeta,
  onEvidenceSelect,
  readOnly = false,
  active = true,
}: {
  noteId: string;
  active?: boolean;
  workspaceId?: string;
  isEnded: boolean;
  readOnly?: boolean;
  noteMeta?: NoteMeta | null;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const t = useTranslations("notes.summary");
  const tActions = useTranslations("common.actions");
  const streamHealthy = useEventStreamHealthy();
  const analysisQuery = useGetLatestAnalysis(noteId, {
    query: {
      retry: false,
      refetchInterval: (query) =>
        hintedInterval(
          streamHealthy,
          isRunning(runningStatusOf(query.state.data))
            ? POLL_INTERVAL_MS
            : false
        ),
    },
  });
  const requestAnalysis = useRequestAnalysis();
  const transcriptQuery = useGetNoteTranscript(noteId);
  const transcriptSegments =
    transcriptQuery.data?.status === 200 && transcriptQuery.data.data.success
      ? transcriptQuery.data.data.data.segments
      : undefined;
  const segmentById = useMemo(
    () => segmentsById(transcriptSegments ?? []),
    [transcriptSegments]
  );

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
  useSummaryViewed(
    noteId,
    workspaceId,
    active && isEnded && analysis?.status === "SUCCEEDED"
  );
  const isMissing =
    errorCodeOf(analysisQuery.error) === "ANALYSIS_JOB_NOT_FOUND";

  const isRequesting =
    requestAnalysis.isPending ||
    analysisQuery.isFetching ||
    isRunning(analysis?.retry?.status);
  const startAnalysis = () =>
    requestAnalysis.mutate(
      { noteId },
      { onSuccess: () => void analysisQuery.refetch() }
    );

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
          {analysis.retry && !readOnly ? (
            <RetryStrip
              retry={analysis.retry}
              onRetry={startAnalysis}
              isRetrying={isRequesting}
            />
          ) : null}
          <div className="mt-3 flex items-center justify-end gap-1">
            {readOnly ? null : (
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                loading={isRequesting}
                onClick={startAnalysis}
              >
                {t("regenerate")}
              </Button>
            )}
            {noteMeta ? (
              <CopyMarkdownButton
                kind="summary"
                className="h-[30px]"
                build={(doc) =>
                  summaryToMarkdown({
                    doc,
                    note: noteMeta,
                    sections: analysis.sections,
                  })
                }
              />
            ) : null}
          </div>
        </div>
        <SummarySections
          analysis={analysis}
          segmentById={segmentById}
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
                {t("failed.title")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--el-muted)]">
                {analysis.errorMessage ?? t("failed.fallback")}
                {analysis.errorCode ? ` (${analysis.errorCode})` : null}
              </p>
              {readOnly ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-[30px]"
                  disabled={isRequesting}
                  onClick={startAnalysis}
                >
                  {t("failed.reanalyze")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (isMissing) {
    return (
      <Shell>
        <div className="rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-5">
          <p className="text-sm font-medium text-[var(--el-ink)]">
            {isEnded ? t("missing.endedTitle") : t("missing.liveTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--el-muted)]">
            {!isEnded
              ? t("missing.liveBody")
              : readOnly
                ? t("missing.readOnlyBody")
                : t("missing.endedBody")}
          </p>
          {isEnded && !readOnly ? (
            <Button
              size="sm"
              className="mt-3 h-[30px]"
              disabled={isRequesting}
              onClick={startAnalysis}
            >
              {t("create")}
            </Button>
          ) : null}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div role="alert" className="space-y-2">
        <p className="text-sm text-[var(--el-ink)]">{t("loadFailed")}</p>
        <Button
          variant="outline"
          size="sm"
          className="h-[30px]"
          onClick={() => void analysisQuery.refetch()}
        >
          {tActions("retry")}
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

const SUMMARY_SKELETON_WIDTHS: Record<string, string[]> = {
  OVERVIEW: ["78%", "54%"],
  ACTION_ITEM: ["64%", "82%", "47%"],
  DECISION: ["71%", "58%"],
};

function SummaryFetchSkeleton() {
  const t = useTranslations("notes.summary");
  return (
    <Shell>
      <div className="space-y-14" aria-label={t("loading")}>
        {SECTION_ORDER.map((kind) => (
          <section key={kind}>
            <div className="flex items-baseline justify-between gap-4 border-b border-[var(--el-hairline-strong)] pb-2">
              <h2 className="text-xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
                {t(`sections.${kind}`)}
              </h2>
            </div>
            <div className="mt-5 space-y-5">
              {(SUMMARY_SKELETON_WIDTHS[kind] ?? []).map((width, row) => (
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

function AnalyzingProgress() {
  const t = useTranslations("notes.summary.analyzing");
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
            {t("title")}
          </p>
        </div>
        <p className="mt-1.5 pl-[26px] text-xs leading-relaxed text-[var(--el-muted)]">
          {t("body")}
        </p>
      </div>
    </Shell>
  );
}

function RetryStrip({
  retry,
  onRetry,
  isRetrying,
}: {
  retry: NonNullable<AnalysisResultResponseDataRetry>;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const t = useTranslations("notes.summary.retryStrip");
  const tActions = useTranslations("common.actions");
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
          {t("failed")}
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
          {tActions("retry")}
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
        {t("running")}
        <span className="text-[var(--el-muted)]">{` ${t("runningHint")}`}</span>
      </p>
    </div>
  );
}

type SegmentById = ReadonlyMap<string, TranscriptResponseDataSegmentsItem>;

function SummarySections({
  analysis,
  segmentById,
  onEvidenceSelect,
}: {
  analysis: AnalysisResultResponseData;
  segmentById: SegmentById;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const t = useTranslations("notes.summary");
  const byKind = new Map<string, AnalysisResultResponseDataSectionsItem>(
    analysis.sections.map((section) => [section.kind, section])
  );
  return (
    <Shell>
      <div className="space-y-14">
        {SECTION_ORDER.map((kind) => {
          const items = byKind.get(kind)?.items ?? [];
          return (
            <section key={kind} aria-label={t(`sections.${kind}`)}>
              <div className="flex items-baseline justify-between gap-4 border-b border-[var(--el-hairline-strong)] pb-2">
                <h2 className="text-xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
                  {t(`sections.${kind}`)}
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
                      segmentById={segmentById}
                      onEvidenceSelect={onEvidenceSelect}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-sm text-[var(--el-muted)]">
                  {t("sectionEmpty")}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </Shell>
  );
}

function SummaryItem({
  item,
  kind,
  segmentById,
  onEvidenceSelect,
}: {
  item: AnalysisResultResponseDataSectionsItemItemsItem;
  kind: AnalysisResultResponseDataSectionsItemKind;
  segmentById: SegmentById;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const t = useTranslations("notes.summary");
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const evidenceId = `evidence-${item.itemId}`;
  const isProse = kind === "OVERVIEW";
  const hasEvidence = item.evidence.length > 0;

  const claim = (
    <>
      {item.content}
      {hasEvidence ? (
        <>
          <span className="sr-only">{` ${t("evidenceCount", { count: item.evidence.length })}`}</span>
        </>
      ) : null}
      {hasEvidence ? (
        <span
          aria-hidden
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
          /* 키보드 Space·Enter 가 만드는 click 은 `detail === 0` 이라, 드래그 선택 방어는 포인터 click 에만 건다. */
          onClick={(event) => {
            const byPointer = event.detail > 0;
            if (byPointer && !window.getSelection()?.isCollapsed) return;
            setOpen((current) => !current);
          }}
          className="group/claim -mx-2 block w-full select-text rounded-block px-2 py-0.5 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
        >
          <span className="block text-[15px] leading-7 text-[var(--el-ink)]">
            {claim}
          </span>
        </button>
      ) : (
        <p className="text-[15px] leading-7 text-[var(--el-ink)]">{claim}</p>
      )}

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
              {item.evidence.map((evidence) => {
                const startedAtMs = segmentById.get(
                  evidence.segmentId
                )?.startedAtMs;
                return (
                  <li key={evidence.segmentId}>
                    <button
                      type="button"
                      onClick={() => onEvidenceSelect(evidence.segmentId)}
                      className="group -mx-2 flex w-full items-baseline gap-2 rounded-block px-2 py-1 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
                    >
                      <span className="min-w-0 text-[15px] leading-7 text-[var(--el-body)]">
                        {evidence.text}
                      </span>
                      <span
                        aria-hidden
                        className="min-w-0 flex-1 translate-y-[-4px] border-b border-dotted border-[var(--el-hairline)]"
                      />
                      {startedAtMs === undefined ? null : (
                        <time className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] transition-colors group-hover:text-[var(--el-muted)]">
                          {formatOffset(startedAtMs)}
                        </time>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
