"use client";

import { useMemo, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RegionStatus, ReviewRelation } from "@/lib/notes/meeting-review/contract";
import type { Conflict, EditsState, RelationEdit } from "@/lib/notes/meeting-review/edits";
import { layoutRelationWeb } from "@/lib/notes/meeting-review/relation-web";
import type { ReviewScreen } from "@/lib/notes/meeting-review/select";
import { cn } from "@/lib/utils";

import { CitationList } from "./citation-list";
import { RegionFrame, StatusChip } from "./region-frame";
import { RelationWebView } from "./relation-web";

const JUDGEMENT_LABEL: Record<ReviewRelation["judgement"]["status"], string> = {
  PROPOSED: "미판정",
  ACCEPTED: "수락",
  MODIFIED: "수정 수락",
  REJECTED: "기각",
};

/**
 * 「명제 연결」 영역. 목록 + 양쪽 비교 + 선택 항목의 1-hop 뷰.
 *
 * 회의 안 관계는 두 끝 항목과 이유·근거를, 프로젝트 레벨 관계는 이전 확정 내용과 이번
 * 내용, 승인 시 효과를 나란히 그린다. `kind` 로 분기하지 않는다 — label·방향·근거만.
 */
export function RelationsPanel({
  screen,
  edits,
  selectedItemId,
  canEdit,
  onSelectItem,
  onJudge,
  onKeepLocal,
  onTakeServer,
  onRecheck,
  recheckPending,
  onEvidenceSelect,
}: {
  screen: ReviewScreen;
  edits: EditsState;
  selectedItemId: string | null;
  canEdit: boolean;
  onSelectItem: (itemId: string) => void;
  onJudge: (relationId: string, edit: RelationEdit) => void;
  onKeepLocal: (relationId: string) => void;
  onTakeServer: (relationId: string) => void;
  onRecheck: () => void;
  recheckPending: boolean;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const layers = {
    IN_MEETING: screen.readiness.inMeetingRelations,
    PROJECT: screen.readiness.projectRelations,
  } as const;
  const hasContent = (status: RegionStatus) => status === "READY" || status === "STALE";
  // 두 층은 독립이다. 한 층이라도 준비됐으면 그 관계는 보여 주고, 나머지 층의 기다림·실패는
  // 그 층의 안내로만 적는다. 둘 다 준비 전일 때만 틀 전체가 기다린다.
  const anyReady = hasContent(layers.IN_MEETING) || hasContent(layers.PROJECT);
  const status: RegionStatus = anyReady
    ? layers.IN_MEETING === "STALE" || layers.PROJECT === "STALE"
      ? "STALE"
      : "READY"
    : combinedStatus(layers.IN_MEETING, layers.PROJECT);
  const anyFailed = layers.IN_MEETING === "FAILED" || layers.PROJECT === "FAILED";
  const visibleRelations = screen.relations.filter((relation) => hasContent(layers[relation.layer]));
  const layout = useMemo(
    () =>
      selectedItemId
        ? layoutRelationWeb(selectedItemId, screen.itemsById, screen.relations)
        : null,
    [selectedItemId, screen.itemsById, screen.relations]
  );
  const staleCount = screen.counts.staleRelations;

  return (
    <RegionFrame
      title="명제 연결"
      status={status}
      waitingLabel="명제 사이의 연결을 판정하고 있습니다. 판정이 끝나야 승인할 수 있습니다."
      emptyLabel="이 회의에서 제안된 연결이 없습니다."
      failedLabel="연결을 판정하지 못했습니다. 다시 판정을 요청할 수 있습니다."
      aside={
        canEdit && (staleCount > 0 || anyFailed) ? (
          <Button size="sm" variant="outline" className="h-7" loading={recheckPending} onClick={onRecheck}>
            <RefreshCw aria-hidden className="size-3.5" />
            {anyFailed ? "다시 판정 요청" : `오래된 ${staleCount}건 재검토`}
          </Button>
        ) : null
      }
      testId="review-relations"
    >
      <div className="space-y-4">
        {(["IN_MEETING", "PROJECT"] as const).map((layer) =>
          hasContent(layers[layer]) ? null : (
            <LayerNotice key={layer} layer={layer} status={layers[layer]} />
          )
        )}
        {layout ? (
          <div className="rounded-[12px] border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-2">
            <RelationWebView layout={layout} onSelectNode={onSelectItem} />
          </div>
        ) : (
          <p className="text-[12px] text-[var(--el-muted-soft)]">
            항목을 고르면 그 항목의 직접 연결만 펼쳐 보입니다.
          </p>
        )}
        <ul className="space-y-2">
          {visibleRelations.map((relation) => (
            <RelationRow
              key={relation.relationId}
              relation={relation}
              screen={screen}
              pending={edits.pendingRelations[relation.relationId] ?? null}
              conflict={edits.conflicts[`relation:${relation.relationId}`] ?? null}
              failure={edits.failures[`relation:${relation.relationId}`] ?? null}
              saving={edits.saving.has(`relation:${relation.relationId}`)}
              unreviewed={screen.unreviewedRelationIds.has(relation.relationId)}
              highlighted={
                selectedItemId !== null &&
                ((relation.from.type === "REVIEW" && relation.from.itemId === selectedItemId) ||
                  (relation.to.type === "REVIEW" && relation.to.itemId === selectedItemId))
              }
              canEdit={canEdit}
              onSelectItem={onSelectItem}
              onJudge={onJudge}
              onKeepLocal={onKeepLocal}
              onTakeServer={onTakeServer}
              onEvidenceSelect={onEvidenceSelect}
            />
          ))}
        </ul>
      </div>
    </RegionFrame>
  );
}

const LAYER_LABEL = { IN_MEETING: "이번 회의 안 연결", PROJECT: "이전 확정과의 연결" } as const;

/** 준비되지 않은 층 하나의 안내. 다른 층의 관계를 가리지 않는다. */
function LayerNotice({ layer, status }: { layer: "IN_MEETING" | "PROJECT"; status: RegionStatus }) {
  const label = LAYER_LABEL[layer];
  if (status === "EMPTY") {
    return <p className="text-[12px] text-[var(--el-muted-soft)]">{label}: 제안된 연결이 없습니다.</p>;
  }
  if (status === "FAILED") {
    return (
      <p role="alert" className="text-[12px] text-[var(--el-error-strong)]">
        {label}: 판정하지 못했습니다. 다시 판정을 요청할 수 있습니다.
      </p>
    );
  }
  return (
    <p role="status" className="text-[12px] text-[var(--el-muted)]">
      {label}: 판정하고 있습니다.
    </p>
  );
}

/** 두 층의 준비 상태를 하나로 접는다. 기다림 > 실패 > 오래됨 > 빈 > 준비 순으로 보수적이다. */
function combinedStatus(a: RegionStatus, b: RegionStatus): RegionStatus {
  const rank: RegionStatus[] = ["GENERATING", "NOT_READY", "FAILED", "STALE", "READY", "EMPTY"];
  if (a === "EMPTY" && b === "EMPTY") return "EMPTY";
  const pick = rank.find((status) => status === a || status === b);
  return pick === "EMPTY" ? "READY" : (pick ?? "READY");
}

function endpointText(ref: ReviewRelation["from"], relation: ReviewRelation, screen: ReviewScreen) {
  if (ref.type === "REVIEW") return screen.itemsById.get(ref.itemId)?.content ?? ref.itemId;
  if (relation.previousApproved?.itemId === ref.itemId) return relation.previousApproved.content;
  return ref.itemId;
}

function RelationRow({
  relation,
  screen,
  pending,
  conflict,
  failure,
  saving,
  unreviewed,
  highlighted,
  canEdit,
  onSelectItem,
  onJudge,
  onKeepLocal,
  onTakeServer,
  onEvidenceSelect,
}: {
  relation: ReviewRelation;
  screen: ReviewScreen;
  pending: RelationEdit | null;
  conflict: Conflict | null;
  failure: string | null;
  saving: boolean;
  unreviewed: boolean;
  highlighted: boolean;
  canEdit: boolean;
  onSelectItem: (itemId: string) => void;
  onJudge: (relationId: string, edit: RelationEdit) => void;
  onKeepLocal: (relationId: string) => void;
  onTakeServer: (relationId: string) => void;
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [label, setLabel] = useState(relation.judgement.label ?? relation.label);
  const status = pending?.judgement ?? relation.judgement.status;
  const shownLabel = pending?.label ?? relation.judgement.label ?? relation.label;

  const endpoint = (ref: ReviewRelation["from"]) => (
    <button
      type="button"
      disabled={ref.type !== "REVIEW"}
      onClick={() => ref.type === "REVIEW" && onSelectItem(ref.itemId)}
      className="min-w-0 flex-1 truncate rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-2 py-1 text-left text-[13px] text-[var(--el-ink)] disabled:cursor-default disabled:text-[var(--el-muted)]"
    >
      {endpointText(ref, relation, screen)}
    </button>
  );

  return (
    <li
      data-testid="review-relation"
      data-relation-id={relation.relationId}
      data-layer={relation.layer}
      data-judgement={status}
      className={cn(
        "space-y-2 rounded-[12px] border bg-[var(--el-surface-card)] px-3.5 py-3",
        highlighted ? "border-[var(--el-hairline-strong)]" : "border-[var(--el-hairline)]",
        status === "REJECTED" && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip>{relation.layer === "PROJECT" ? "이전 확정과 비교" : "이번 회의 안"}</StatusChip>
        {unreviewed ? <StatusChip tone="warn">미판정</StatusChip> : null}
        {relation.stale ? <StatusChip tone="warn">재검토 필요</StatusChip> : null}
        {relation.citations.length === 0 ? <StatusChip>근거 없음</StatusChip> : null}
        {status !== "PROPOSED" ? (
          <StatusChip tone={status === "REJECTED" ? "neutral" : "ok"}>{JUDGEMENT_LABEL[status]}</StatusChip>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {endpoint(relation.from)}
        <span className="flex shrink-0 items-center gap-1 text-[12px] text-[var(--el-muted)]">
          {shownLabel}
          <ArrowRight aria-hidden className="size-3.5" />
        </span>
        {endpoint(relation.to)}
      </div>

      {relation.layer === "PROJECT" && relation.previousApproved ? (
        <dl className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-block border border-[var(--el-hairline)] p-2">
            <dt className="text-[var(--el-muted)]">이전 확정</dt>
            <dd className="mt-0.5 text-[13px] text-[var(--el-ink)]">{relation.previousApproved.content}</dd>
          </div>
          <div className="rounded-block border border-[var(--el-hairline)] p-2">
            <dt className="text-[var(--el-muted)]">이번 회의</dt>
            <dd className="mt-0.5 text-[13px] text-[var(--el-ink)]">{endpointText(relation.from, relation, screen)}</dd>
          </div>
          {relation.effect ? (
            <div className="col-span-2 text-[var(--el-muted)]">
              승인하면 · <span className="text-[var(--el-ink)]">{relation.effect.label}</span>
            </div>
          ) : null}
        </dl>
      ) : null}

      <p className="text-[12px] leading-[1.5] text-[var(--el-muted)]">{relation.rationale}</p>

      {conflict?.kind === "relation" ? (
        <div role="alert" className="space-y-2 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-3 text-[12px]">
          <p className="font-medium text-[var(--el-ink)]">다른 곳에서 먼저 판정됐습니다</p>
          <p className="text-[var(--el-muted)]">
            내 판정 {JUDGEMENT_LABEL[conflict.local.judgement]} · 서버 {JUDGEMENT_LABEL[conflict.server.judgement.status]}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onKeepLocal(relation.relationId)}>
              내 판정 유지
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onTakeServer(relation.relationId)}>
              서버 값으로
            </Button>
          </div>
        </div>
      ) : null}
      {failure ? (
        <p role="alert" className="text-[12px] text-[var(--el-error-strong)]">
          저장하지 못했습니다 · {failure}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="text-[12px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
        >
          근거 {relation.citations.length}
        </button>
        {canEdit ? (
          <div className="ml-auto flex items-center gap-1">
            {modifying ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  setModifying(false);
                  onJudge(relation.relationId, { judgement: "MODIFIED", label: label.trim() || relation.label });
                }}
              >
                <input
                  aria-label="연결 이름"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="h-7 w-40 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas)] px-2 text-[12px]"
                />
                <Button size="sm" type="submit" className="h-7">
                  수정 수락
                </Button>
                <Button size="sm" variant="ghost" type="button" className="h-7" onClick={() => setModifying(false)}>
                  취소
                </Button>
              </form>
            ) : (
              <>
                <Button
                  size="sm"
                  variant={status === "ACCEPTED" ? "default" : "outline"}
                  className="h-7"
                  loading={saving}
                  onClick={() => onJudge(relation.relationId, { judgement: "ACCEPTED" })}
                >
                  수락
                </Button>
                <Button size="sm" variant="ghost" className="h-7" disabled={saving} onClick={() => setModifying(true)}>
                  수정
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  disabled={saving}
                  onClick={() => onJudge(relation.relationId, { judgement: "REJECTED" })}
                >
                  기각
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {open ? <CitationList citations={relation.citations} onEvidenceSelect={onEvidenceSelect} /> : null}
    </li>
  );
}
