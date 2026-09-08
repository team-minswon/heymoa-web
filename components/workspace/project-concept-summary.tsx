"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw, X } from "lucide-react";

import { NoteRouteSurface } from "@/components/notes/note-route-surface";
import { StatusChip } from "@/components/notes/meeting-review/region-frame";
import { CitationList } from "@/components/notes/meeting-review/citation-list";
import { Button } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { formatAppDate } from "@/lib/format/date";
import { fetchConceptSummary, refreshConceptSummary } from "@/lib/notes/meeting-review/api";
import type {
  ConceptSummary,
  ConceptSummaryStatus,
  SummaryStatement,
} from "@/lib/notes/meeting-review/contract";
import { getConceptSummaryQueryKey } from "@/lib/notes/meeting-review/query-keys";

/** 생성 중일 때 도는 폴링. 준비 신호가 계약에 없다. */
export const CONCEPT_SUMMARY_POLL_MS = 4_000;
/** 열어 둔 동안 다른 창의 승인으로 기준이 바뀐 것을 잡는 저주기 재조회. */
export const CONCEPT_SUMMARY_SAFETY_POLL_MS = 30_000;

const STATUS_LABEL: Record<ConceptSummaryStatus, string> = {
  NONE: "아직 요약이 없습니다",
  GENERATING: "AI 가 승인된 내용을 요약하고 있습니다",
  READY: "최신 승인 기준의 요약입니다",
  INSUFFICIENT_EVIDENCE: "요약할 근거가 아직 부족합니다",
  FAILED: "요약을 만들지 못했습니다",
  STALE: "승인이 더 있었습니다. 이 요약은 이전 기준입니다",
};

const SECTION_TITLE: Record<keyof ConceptSummary["sections"], string> = {
  purposeAndScope: "목적과 범위",
  concepts: "핵심 개념과 용어",
  direction: "현재 방향",
  openIssues: "남은 쟁점",
};

/**
 * 프로젝트 개념 요약 화면. **AI 가 승인 사실을 설명한 파생 결과**이고 web 은 읽고 갱신을
 * 요청할 뿐이다. 요약을 만들거나 저장하지 않는다. 승인 전 회의 제안이나 평가는 여기 오지
 * 않는다 — 계약이 승인본과 원본 설명만 근거로 준다.
 *
 * 노트 면과 같은 side 시트에 그린다. 닫으면 워크스페이스 목록으로 돌아간다.
 */
export function ProjectConceptSummary({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    // 첫 커밋 뒤에 연다 — 새로고침 진입에서 면이 뒤늦게 커지지 않게(`note-view` 와 같다).
    const timer = setTimeout(() => setIsOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const projectQuery = useGetProject(workspaceId, projectId, { query: { retry: false } });
  const project =
    projectQuery.data?.status === 200 && projectQuery.data.data.success
      ? projectQuery.data.data.data
      : null;

  const summaryQuery = useQuery({
    queryKey: getConceptSummaryQueryKey(projectId),
    queryFn: () => fetchConceptSummary(projectId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "GENERATING"
        ? CONCEPT_SUMMARY_POLL_MS
        : CONCEPT_SUMMARY_SAFETY_POLL_MS,
  });
  const refresh = useMutation({
    mutationFn: () => refreshConceptSummary(projectId),
    // 재조회가 GENERATING 을 가져올 때까지 pending 을 붙든다 — 그새 또 누르면 중복 요청이다.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: getConceptSummaryQueryKey(projectId) }),
  });

  const close = () => router.push(`/w/${workspaceId}`);
  const summary = summaryQuery.data;
  // 권한 거부는 캐시된 데이터보다 먼저다 — 재조회가 403 이어도 Query 는 옛 이름·설명·요약을 남긴다.
  const forbidden = errorIsForbidden(summaryQuery.error) || errorIsForbidden(projectQuery.error);

  return (
    <NoteRouteSurface view="side" isOpen={isOpen} onClose={close}>
      <div className="flex h-full min-h-0 flex-col" data-testid="project-concept-summary">
        <header className="flex items-start gap-3 border-b border-[var(--el-hairline)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-[var(--el-muted)]">프로젝트 개념 요약</p>
            {forbidden ? null : project ? (
              <h2 className="truncate text-[18px] font-semibold tracking-[-0.01em] text-[var(--el-ink)]">
                {project.name}
              </h2>
            ) : projectQuery.isError ? (
              <InlineRetry
                onRetry={() => void projectQuery.refetch()}
                label="프로젝트 정보를 불러오지 못했습니다"
              />
            ) : (
              <Skeleton className="mt-1 h-6 w-48" />
            )}
            {!forbidden && project?.description ? (
              <p className="mt-1 text-[13px] leading-[1.5] text-[var(--el-body)]">{project.description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" aria-label="닫기" onClick={close}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {summaryQuery.isLoading ? (
            <SummarySkeleton />
          ) : forbidden ? (
            <p role="alert" className="text-[13px] text-[var(--el-muted)]">
              이 프로젝트의 요약을 볼 권한이 없습니다.
            </p>
          ) : !summary ? (
            <InlineRetry
              onRetry={() => void summaryQuery.refetch()}
              label="요약을 불러오지 못했습니다"
            />
          ) : (
            <>
              {summaryQuery.isRefetchError ? (
                // 읽던 내용은 두고 실패만 옆에 적는다 — 갱신 뒤 재조회가 실패하면 옛 결과가 최신처럼 보인다.
                <InlineRetry
                  onRetry={() => void summaryQuery.refetch()}
                  label="요약을 다시 불러오지 못했습니다. 아래는 마지막으로 받은 내용입니다"
                />
              ) : null}
              <SummaryBody
                summary={summary}
                workspaceId={workspaceId}
                refreshing={refresh.isPending}
                onRefresh={() => refresh.mutate()}
              />
            </>
          )}
        </div>
      </div>
    </NoteRouteSurface>
  );
}

function errorIsForbidden(error: unknown) {
  const code = (error as { error?: { code?: string } } | null)?.error?.code;
  return code === "FORBIDDEN" || code === "PROJECT_ACCESS_DENIED";
}

function SummaryBody({
  summary,
  workspaceId,
  refreshing,
  onRefresh,
}: {
  summary: ConceptSummary;
  workspaceId: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const generating = summary.status === "GENERATING";
  const hasContent = Object.values(summary.sections).some((section) => section.length > 0);

  return (
    <div className="space-y-6">
      <div
        data-testid="summary-status"
        data-status={summary.status}
        className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3"
      >
        <StatusChip tone="ai">AI 가 승인 사실을 설명한 결과</StatusChip>
        {summary.status === "STALE" ? <StatusChip tone="warn">오래됨</StatusChip> : null}
        {summary.status === "FAILED" ? <StatusChip tone="error">실패</StatusChip> : null}
        <p role={generating ? "status" : undefined} className="flex items-center gap-1.5 text-[13px] text-[var(--el-body)]">
          {generating ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
          {summary.status === "FAILED" ? (
            <AlertTriangle aria-hidden className="size-3.5 text-[var(--el-error)]" />
          ) : null}
          {STATUS_LABEL[summary.status]}
          {summary.status === "FAILED" && summary.error ? ` · ${summary.error}` : ""}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7"
          loading={refreshing}
          disabled={generating}
          onClick={onRefresh}
          data-testid="refresh-summary"
        >
          <RefreshCw aria-hidden className="size-3.5" />
          {summary.status === "NONE" ? "요약 만들기" : "다시 요약"}
        </Button>
        <dl className="flex w-full flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[var(--el-muted-soft)]">
          <div className="flex gap-1">
            <dt>기준 승인 버전</dt>
            <dd className="tabular-nums">
              {summary.basis.approvalVersion}
              {summary.current && summary.current.approvalVersion !== summary.basis.approvalVersion
                ? ` → 지금 ${summary.current.approvalVersion}`
                : ""}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>원본 설명 revision</dt>
            <dd className="tabular-nums">{summary.basis.descriptionRevision}</dd>
          </div>
          {summary.generatedAt ? (
            <div className="flex gap-1">
              <dt>생성</dt>
              <dd>{formatAppDate(summary.generatedAt, { dateStyle: "medium", timeStyle: "short" })}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {hasContent ? (
        (Object.keys(SECTION_TITLE) as (keyof ConceptSummary["sections"])[]).map((key) => (
          <section key={key} className="space-y-2">
            <h3 className="border-b border-[var(--el-hairline)] pb-1.5 text-[14px] font-semibold text-[var(--el-ink)]">
              {SECTION_TITLE[key]}
            </h3>
            {summary.sections[key].length === 0 ? (
              <p className="text-[12px] text-[var(--el-muted-soft)]">이 묶음에는 설명이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {summary.sections[key].map((statement, index) => (
                  <StatementRow key={index} statement={statement} workspaceId={workspaceId} />
                ))}
              </ul>
            )}
          </section>
        ))
      ) : summary.status === "READY" ? (
        <p className="text-[13px] text-[var(--el-muted)]">요약에 담을 승인된 내용이 없습니다.</p>
      ) : null}
    </div>
  );
}

function StatementRow({
  statement,
  workspaceId,
}: {
  statement: SummaryStatement;
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <li data-testid="summary-statement" className="rounded-[12px] border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-3.5 py-3">
      <p className="text-[14px] leading-[1.55] text-[var(--el-ink)]">
        {statement.term ? <strong className="mr-1.5 font-semibold">{statement.term}</strong> : null}
        {statement.text}
      </p>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="mt-1.5 text-[12px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
      >
        근거 {statement.sources.length}
      </button>
      {open ? (
        <ul className="mt-1.5 space-y-2">
          {statement.sources.length === 0 ? (
            <li className="text-[12px] text-[var(--el-muted-soft)]">근거 없음</li>
          ) : (
            statement.sources.map((source, index) => (
              <li key={index} className="space-y-1 text-[12px] text-[var(--el-muted)]">
                {source.type === "PROJECT_DESCRIPTION" ? (
                  <span>원본 설명 revision {source.descriptionRevision ?? "—"}</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-1.5">
                    승인 항목
                    <span className="tabular-nums">rev {source.revision ?? "—"}</span>
                    {source.noteId ? (
                      <Link
                        href={`/w/${workspaceId}/notes/${source.noteId}?tab=summary`}
                        className="underline decoration-dotted underline-offset-2 hover:text-[var(--el-ink)]"
                      >
                        회의 열기
                      </Link>
                    ) : null}
                  </span>
                )}
                {source.citations && source.citations.length > 0 ? (
                  <CitationList
                    citations={source.citations}
                    onEvidenceSelect={(segmentId) => {
                      if (source.noteId) {
                        router.push(
                          `/w/${workspaceId}/notes/${source.noteId}?tab=transcript&segment=${segmentId}`
                        );
                      }
                    }}
                  />
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </li>
  );
}

function SummarySkeleton() {
  return (
    <div aria-label="요약을 불러오는 중" className="space-y-6">
      <Skeleton className="h-[74px] w-full rounded-[12px]" />
      {Object.values(SECTION_TITLE).map((title) => (
        <section key={title} className="space-y-2">
          <h3 className="border-b border-[var(--el-hairline)] pb-1.5 text-[14px] font-semibold text-[var(--el-ink)]">
            {title}
          </h3>
          <Skeleton className="h-[60px] w-full rounded-[12px]" />
        </section>
      ))}
    </div>
  );
}
