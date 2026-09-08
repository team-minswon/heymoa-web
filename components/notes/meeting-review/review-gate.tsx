"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ApprovalBlockerCode,
  ApprovalRejected,
  MeetingApproval,
} from "@/lib/notes/meeting-review/contract";
import type { ReviewScreen } from "@/lib/notes/meeting-review/select";
import { formatAppDate } from "@/lib/format/date";

import { StatusChip } from "./region-frame";

const BLOCKER_LABEL: Record<ApprovalBlockerCode, string> = {
  UNREVIEWED_ITEMS: "미검토 항목",
  UNREVIEWED_RELATIONS: "미판정 연결",
  STALE_RELATIONS: "재검토가 필요한 연결",
  REQUIRED_RELATION_FAILED: "필수 연결 판정 실패",
  RELATIONS_GENERATING: "연결 판정 진행 중",
  NOT_MEETING_STARTER: "회의 시작자만 승인할 수 있습니다",
};

const REJECT_LABEL: Record<ApprovalRejected["code"], string> = {
  UNREVIEWED_ITEMS: "아직 검토하지 않은 항목이 있습니다",
  UNREVIEWED_RELATIONS: "아직 판정하지 않은 연결이 있습니다",
  STALE_RELATIONS: "다시 검토해야 할 연결이 있습니다",
  REQUIRED_RELATION_FAILED: "필수 연결의 판정이 실패했습니다",
  REVIEW_VERSION_CONFLICT: "검토본이 다른 곳에서 바뀌었습니다. 다시 읽어 왔습니다",
  PROJECT_VERSION_CONFLICT: "프로젝트의 승인 버전이 바뀌었습니다. 비교를 다시 해야 합니다",
};

export type ApprovalDetail =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; data: MeetingApproval };

/**
 * 「검토·확정」 영역. 무엇이 남았는지, 저장됐는지, 승인할 수 있는지.
 *
 * 승인 버튼은 회의 시작자에게만 그리지만 **활성 여부와 거부는 server 판정**이다. web 은
 * `canApprove` 를 다시 계산하지 않는다. 미저장 편집이 있으면 승인 전에 먼저 저장한다 —
 * 그 흐름은 provider 가 갖고 여기는 버튼과 사유만 그린다.
 *
 * **승인 사실은 검토본의 `approved` 메타가 정한다.** 승인 상세 조회가 실패해도 「미승인」으로
 * 되돌아가지 않는다 — 실패와 없음은 다르다. 「검토본」과 「확정됨」을 배지로 가른다.
 */
export function ReviewGate({
  screen,
  isStarter,
  unsavedCount,
  approving,
  rejected,
  approvalDetail,
  onApprove,
  onJumpTo,
}: {
  screen: ReviewScreen;
  isStarter: boolean;
  unsavedCount: number;
  approving: boolean;
  rejected: ApprovalRejected | null;
  /** 승인됐을 때의 상세 조회 상태. 미승인이면 null. */
  approvalDetail: ApprovalDetail | null;
  onApprove: () => void;
  onJumpTo: (target: { itemId?: string; relationId?: string }) => void;
}) {
  const isApproved = Boolean(screen.approved);
  const blockers = screen.approval.blockers;

  return (
    <section
      data-testid="review-gate"
      data-approved={isApproved ? "" : undefined}
      className="space-y-3 rounded-[12px] border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--el-ink)]">검토·확정</h3>
        {isApproved ? (
          <StatusChip tone="ok">프로젝트 지식으로 확정됨</StatusChip>
        ) : (
          <StatusChip>검토본 · 아직 확정되지 않음</StatusChip>
        )}
        {unsavedCount > 0 ? <StatusChip tone="warn">저장 안 된 편집 {unsavedCount}</StatusChip> : null}
      </header>

      {isApproved ? (
        approvalDetail?.status === "ready" ? (
          <ApprovedSummary approved={approvalDetail.data} />
        ) : approvalDetail?.status === "error" ? (
          <InlineRetry onRetry={approvalDetail.retry} label="승인 상세를 불러오지 못했습니다" />
        ) : (
          <div aria-label="승인 상세를 불러오는 중" className="space-y-1.5">
            <Skeleton className="h-4 w-[52%]" />
            <Skeleton className="h-4 w-[38%]" />
          </div>
        )
      ) : (
        <>
          <ul className="space-y-1 text-[13px]">
            {blockers.length === 0 ? (
              <li className="flex items-center gap-1.5 text-[var(--el-ink)]">
                <CheckCircle2 aria-hidden className="size-4 text-[var(--el-success)]" />
                검토가 끝났습니다. 회의 전체를 승인할 수 있습니다.
              </li>
            ) : (
              blockers.map((blocker) => (
                <li key={blocker.code} className="flex flex-wrap items-center gap-1.5 text-[var(--el-body)]">
                  <span>{BLOCKER_LABEL[blocker.code]}</span>
                  {blocker.refs?.length ? (
                    <span className="flex flex-wrap gap-1">
                      {blocker.refs.map((ref) => (
                        <button
                          key={ref}
                          type="button"
                          onClick={() =>
                            onJumpTo(screen.itemsById.has(ref) ? { itemId: ref } : { relationId: ref })
                          }
                          className="rounded-[6px] border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-1.5 text-[12px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
                        >
                          {screen.itemsById.get(ref)?.content.slice(0, 18) ?? "연결"}
                        </button>
                      ))}
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>

          {rejected ? (
            <div role="alert" className="flex gap-2.5 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
              <div className="text-[13px]">
                <p className="font-medium text-[var(--el-ink)]">승인되지 않았습니다</p>
                <p className="text-[var(--el-muted)]">{REJECT_LABEL[rejected.code] ?? rejected.message}</p>
              </div>
            </div>
          ) : null}

          {isStarter ? (
            <Button
              data-testid="approve-meeting"
              loading={approving}
              disabled={!screen.approval.canApprove}
              onClick={onApprove}
            >
              회의 전체 승인
            </Button>
          ) : (
            <p className="text-[12px] text-[var(--el-muted)]">승인은 회의 시작자가 합니다.</p>
          )}
        </>
      )}
    </section>
  );
}

function ApprovedSummary({ approved }: { approved: MeetingApproval }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
      <dt className="text-[var(--el-muted)]">승인</dt>
      <dd className="text-[var(--el-ink)]">
        {formatAppDate(approved.approvedAt, { dateStyle: "medium", timeStyle: "short" })}
      </dd>
      <dt className="text-[var(--el-muted)]">승인 버전</dt>
      <dd className="tabular-nums text-[var(--el-ink)]">{approved.approvalVersion}</dd>
      <dt className="text-[var(--el-muted)]">승인 항목</dt>
      <dd className="tabular-nums text-[var(--el-ink)]">
        {approved.items.length} · 연결 {approved.relations.length}
      </dd>
      <dt className="text-[var(--el-muted)]">승인 당시 평가</dt>
      <dd className="text-[var(--el-ink)]">
        {approved.evaluationRef && approved.evaluationRef.status === "READY"
          ? `버전 ${approved.evaluationRef.resultVersion ?? "—"}`
          : "평가 없이 승인됨"}
      </dd>
    </dl>
  );
}
