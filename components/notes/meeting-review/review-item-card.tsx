"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReviewItem } from "@/lib/notes/meeting-review/contract";
import type { Conflict, ItemEdit } from "@/lib/notes/meeting-review/edits";
import { CONTEXT_KIND_ICON, CONTEXT_KIND_LABEL } from "@/lib/notes/proposals/presentation";
import { cn } from "@/lib/utils";

import { CitationList } from "./citation-list";
import { StatusChip } from "./region-frame";

export type ReviewItemCardProps = {
  item: ReviewItem;
  /** 미저장 편집을 얹은 값. 화면은 이것을 그린다. */
  shown: ReviewItem;
  unreviewed: boolean;
  relationCount: number;
  selected: boolean;
  canEdit: boolean;
  saving: boolean;
  conflict: Conflict | null;
  failure: string | null;
  kindInHeader: boolean;
  onSelect: (itemId: string) => void;
  onEdit: (itemId: string, edit: ItemEdit) => void;
  /** 편집 완료 단위 — blur · 제외/복원 누름. 키 입력마다 부르지 않는다. */
  onCommit: (itemId: string) => void;
  /** 내용을 바꾸지 않고 「봤다」를 저장한다. 미검토 항목에만 보인다. */
  onMarkReviewed: (itemId: string) => void;
  onKeepLocal: (itemId: string) => void;
  onTakeServer: (itemId: string) => void;
  onEvidenceSelect: (segmentId: string) => void;
};

/**
 * 검토 항목 하나. 기하는 `proposal-card.tsx` 의 행 카드를 따른다 — 왼쪽 26 배지가 유형,
 * 오른쪽 본문이 내용·메타·근거. 여기에 편집(내용 · 제외/복원)과 검토 상태 배지가 붙는다.
 *
 * **승인 전 항목은 「검토본」이다.** 어디에도 「확정」이라는 말을 쓰지 않는다.
 */
export function ReviewItemCard({
  item,
  shown,
  unreviewed,
  relationCount,
  selected,
  canEdit,
  saving,
  conflict,
  failure,
  kindInHeader,
  onSelect,
  onEdit,
  onCommit,
  onMarkReviewed,
  onKeepLocal,
  onTakeServer,
  onEvidenceSelect,
}: ReviewItemCardProps) {
  const KindIcon = CONTEXT_KIND_ICON[shown.kind];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shown.content);
  /** 편집을 여는 순간의 값에서 시작한다. 열려 있는 동안 서버 값이 바뀌어도 입력을 덮지 않는다. */
  const [baseRevision, setBaseRevision] = useState(item.revision);
  const beginEditing = () => {
    setDraft(shown.content);
    setBaseRevision(item.revision);
    setEditing(true);
  };

  const commitContent = () => {
    setEditing(false);
    const next = draft.trim();
    // 서버 값과 같아졌어도 미저장 편집이 남아 있으면(`shown` 이 서버와 다르면) 그것을 갈아야 한다.
    if (next !== item.content || shown.content !== item.content) {
      onEdit(item.itemId, { content: next, baseRevision });
      onCommit(item.itemId);
    }
  };

  const toggleIncluded = () => {
    onEdit(item.itemId, { included: !shown.included, baseRevision: item.revision });
    onCommit(item.itemId);
  };

  const meta: string[] = [];
  if (!kindInHeader) meta.push(CONTEXT_KIND_LABEL[shown.kind]);
  if (shown.assigneeText) meta.push(`담당 ${shown.assigneeText}`);
  if (shown.dueText) meta.push(`기한 ${shown.dueText}`);
  if (relationCount > 0) meta.push(`연결 ${relationCount}`);

  return (
    <li
      data-testid="review-item"
      data-item-id={item.itemId}
      data-unreviewed={unreviewed ? "" : undefined}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex gap-[11px] rounded-[12px] border bg-[var(--el-surface-card)] px-3.5 py-[13px] shadow-[0_1px_2px_#00000010]",
        selected ? "border-[var(--el-hairline-strong)]" : "border-[var(--el-hairline)]",
        !shown.included && "opacity-60"
      )}
    >
      <span
        aria-hidden
        className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
      >
        <KindIcon className="size-3.5 text-[var(--el-body)]" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {unreviewed ? <StatusChip tone="warn">미검토</StatusChip> : null}
          {shown.stale ? <StatusChip tone="warn">원본 바뀜</StatusChip> : null}
          {!shown.included ? <StatusChip>제외됨</StatusChip> : null}
          {shown.edited ? <StatusChip>사람이 고침</StatusChip> : null}
          {item.originalProposalRef === null ? <StatusChip>사람이 추가</StatusChip> : null}
          {item.citations.length === 0 ? <StatusChip>근거 없음</StatusChip> : null}
        </div>

        {editing ? (
          <textarea
            autoFocus
            aria-label="항목 내용"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitContent}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setDraft(item.content);
                setEditing(false);
              }
            }}
            className="w-full resize-y rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas)] px-2 py-1.5 text-[14px] leading-[1.55] text-[var(--el-ink)] outline-none focus-visible:border-[var(--el-hairline-strong)]"
            rows={2}
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect(item.itemId)}
            onDoubleClick={() => canEdit && !saving && beginEditing()}
            className="block w-full text-left text-[14px] leading-[1.55] text-[var(--el-ink)]"
          >
            {shown.content}
          </button>
        )}

        {meta.length > 0 ? (
          <p className="text-[12px] text-[var(--el-muted)]">{meta.join(" · ")}</p>
        ) : null}

        {conflict?.kind === "item" ? (
          <div
            role="alert"
            className="space-y-2 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-3"
          >
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--el-ink)]">
              <AlertTriangle className="size-3.5 text-[var(--el-error)]" />
              다른 곳에서 먼저 바뀌었습니다
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[12px]">
              <dt className="text-[var(--el-muted)]">내 편집</dt>
              <dd className="text-[var(--el-ink)]">
                {conflict.local.content ?? (conflict.local.included === false ? "제외" : "복원")}
              </dd>
              <dt className="text-[var(--el-muted)]">서버 값</dt>
              <dd className="text-[var(--el-ink)]">
                {conflict.server.content}
                {conflict.server.included ? "" : " (제외됨)"}
              </dd>
            </dl>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onKeepLocal(item.itemId)}>
                내 편집 유지
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onTakeServer(item.itemId)}>
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

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
          >
            <ChevronDown
              aria-hidden
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
            />
            근거 {item.citations.length}
          </button>
          {canEdit ? (
            <>
              {unreviewed ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7"
                  loading={saving}
                  onClick={() => onMarkReviewed(item.itemId)}
                >
                  검토 완료
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className={cn("h-7", !unreviewed && "ml-auto")}
                onClick={beginEditing}
                disabled={saving || editing}
              >
                수정
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                loading={saving}
                onClick={toggleIncluded}
              >
                {shown.included ? "제외" : "복원"}
              </Button>
            </>
          ) : null}
        </div>

        {open ? (
          <CitationList citations={item.citations} onEvidenceSelect={onEvidenceSelect} />
        ) : null}
      </div>
    </li>
  );
}
