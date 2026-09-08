"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReviewItem } from "@/lib/notes/meeting-review/contract";
import type { EditsState } from "@/lib/notes/meeting-review/edits";
import { effectiveItem } from "@/lib/notes/meeting-review/edits";
import type { ReviewScreen, ScreenRegion } from "@/lib/notes/meeting-review/select";
import { CONTEXT_KIND_LABEL } from "@/lib/notes/proposals/presentation";
import { proposalKindSchema } from "@/lib/notes/proposals/contract";

import { RegionFrame } from "./region-frame";
import { ReviewItemCard, type ReviewItemCardProps } from "./review-item-card";

type ItemActions = Pick<
  ReviewItemCardProps,
  | "onSelect"
  | "onEdit"
  | "onCommit"
  | "onMarkReviewed"
  | "onKeepLocal"
  | "onTakeServer"
  | "onEvidenceSelect"
>;

/**
 * 「회의 결과」 영역. server 가 저장한 영역(제목·순서)과 항목을 그대로 그린다 — web 이
 * 순서를 다시 정하거나 같은 항목을 유사도로 합치지 않는다. 영역에 안 들어간 항목은
 * 「기타」로 아래에 둔다.
 */
export function ReviewRegions({
  screen,
  edits,
  selectedItemId,
  canEdit,
  onAddItem,
  actions,
  onDraftChange,
}: {
  screen: ReviewScreen;
  edits: EditsState;
  selectedItemId: string | null;
  canEdit: boolean;
  onAddItem: (
    regionId: string | undefined,
    kind: string,
    content: string
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  actions: ItemActions;
  /** 추가 폼이 열리거나 닫혔다. 승인 전 검사가 작성 중인 초안을 센다. */
  onDraftChange?: (key: string, open: boolean) => void;
}) {
  const renderItem = (item: ReviewItem, kindInHeader: boolean) => (
    <ReviewItemCard
      key={item.itemId}
      item={item}
      shown={effectiveItem(edits, item)}
      unreviewed={screen.unreviewedItemIds.has(item.itemId)}
      relationCount={screen.relationsByItem.get(item.itemId)?.length ?? 0}
      selected={selectedItemId === item.itemId}
      canEdit={canEdit}
      saving={edits.saving.has(`item:${item.itemId}`)}
      conflict={edits.conflicts[`item:${item.itemId}`] ?? null}
      failure={edits.failures[`item:${item.itemId}`] ?? null}
      kindInHeader={kindInHeader}
      {...actions}
    />
  );

  // 빈 검토본에서도 사람이 첫 항목을 넣을 수 있어야 한다. 서버가 EMPTY 라고 해도 편집 권한이
  // 있으면 틀은 열어 두고, 빈 안내와 추가 폼만 그린다.
  const nothingToShow = screen.regions.length === 0 && screen.unplacedItems.length === 0;
  const openAlthoughEmpty =
    canEdit && (screen.readiness.items === "EMPTY" || (screen.readiness.items === "READY" && nothingToShow));
  return (
    <RegionFrame
      title="회의 결과"
      status={openAlthoughEmpty ? "READY" : screen.readiness.items}
      waitingLabel="회의 명제를 정리하는 중입니다. 준비되면 여기에 보입니다. 다른 화면으로 옮겨도 됩니다."
      emptyLabel="이 회의에서 정리된 명제가 없습니다."
      failedLabel="명제를 준비하지 못했습니다. 회의 기록은 그대로 남아 있습니다."
      testId="review-regions"
    >
      <div className="space-y-6">
        {screen.regions.map((region) => (
          <RegionBlock
            key={region.regionId}
            region={region}
            canEdit={canEdit}
            onAddItem={onAddItem}
            onDraftChange={onDraftChange}
          >
            {region.items.map((item) => renderItem(item, region.kind === item.kind))}
          </RegionBlock>
        ))}
        {openAlthoughEmpty && nothingToShow ? (
          <p className="text-[13px] text-[var(--el-muted-soft)]">
            이 회의에서 정리된 명제가 없습니다. 빠진 결과가 있으면 직접 추가할 수 있습니다.
          </p>
        ) : null}
        {screen.unplacedItems.length > 0 || (openAlthoughEmpty && nothingToShow) ? (
          <RegionBlock
            region={{ regionId: "unplaced", title: "기타", kind: "", items: screen.unplacedItems }}
            canEdit={canEdit}
            onAddItem={onAddItem}
            onDraftChange={onDraftChange}
          >
            {screen.unplacedItems.map((item) => renderItem(item, false))}
          </RegionBlock>
        ) : null}
      </div>
    </RegionFrame>
  );
}

function RegionBlock({
  region,
  canEdit,
  onAddItem,
  children,
  onDraftChange,
}: {
  region: ScreenRegion;
  canEdit: boolean;
  onAddItem: (
    regionId: string | undefined,
    kind: string,
    content: string
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  children: React.ReactNode;
  onDraftChange?: (key: string, open: boolean) => void;
}) {
  const [adding, setAdding] = useState(false);
  const draftKey = `add:${region.regionId}`;
  // 승인으로 권한이 사라지면 열린 폼도 닫힌다. 초안 등록은 폼이 실제로 보이는 동안만이다.
  const showForm = adding && canEdit;
  useEffect(() => {
    if (!showForm) return;
    onDraftChange?.(draftKey, true);
    return () => onDraftChange?.(draftKey, false);
  }, [showForm, draftKey, onDraftChange]);
  const openAdd = () => setAdding(true);
  const closeAdd = () => setAdding(false);

  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [kind, setKind] = useState<string>(
    proposalKindSchema.options.includes(region.kind as never) ? region.kind : "DECISION"
  );
  const [content, setContent] = useState("");
  const regionId = region.regionId === "unplaced" ? undefined : region.regionId;

  /** 성공했을 때만 비운다 — 실패하면 쓴 내용을 남기고 사유를 보여 준다. 요청 중에는 다시 못 보낸다. */
  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting || !canEdit) return;
    setSubmitting(true);
    setFailure(null);
    const result = await onAddItem(regionId, kind, trimmed);
    setSubmitting(false);
    if (result.ok) {
      setContent("");
      closeAdd();
    } else {
      setFailure(result.message);
    }
  };

  return (
    <div data-testid="review-region" data-region-id={region.regionId} className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h4 className="text-[13px] font-medium text-[var(--el-muted)]">
          {region.title}
          <span className="ml-1.5 tabular-nums text-[var(--el-muted-soft)]">{region.items.length}</span>
        </h4>
        {canEdit && !adding ? (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
          >
            <Plus aria-hidden className="size-3.5" />
            항목 추가
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">{children}</ul>
      {showForm ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-2 rounded-[12px] border border-dashed border-[var(--el-hairline-strong)] p-3"
        >
          <div className="flex gap-2">
            <select
              aria-label="유형"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="h-8 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas)] px-2 text-[12px] text-[var(--el-ink)]"
            >
              {proposalKindSchema.options.map((option) => (
                <option key={option} value={option}>
                  {CONTEXT_KIND_LABEL[option]}
                </option>
              ))}
            </select>
            <textarea
              autoFocus
              aria-label="추가할 내용"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={2}
              className="min-w-0 flex-1 resize-y rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas)] px-2 py-1.5 text-[14px] leading-[1.55] text-[var(--el-ink)] outline-none focus-visible:border-[var(--el-hairline-strong)]"
            />
          </div>
          {failure ? (
            <p role="alert" className="text-[12px] text-[var(--el-error-strong)]">
              추가하지 못했습니다 · {failure}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" type="button" disabled={submitting} onClick={closeAdd}>
              취소
            </Button>
            <Button size="sm" type="submit" loading={submitting} disabled={!content.trim()}>
              추가
            </Button>
          </div>
          <p className="text-[11px] text-[var(--el-muted-soft)]">
            사람이 추가한 항목은 원본 명제와 근거가 없는 것으로 남습니다.
          </p>
        </form>
      ) : null}
    </div>
  );
}
