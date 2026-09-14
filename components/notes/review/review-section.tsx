"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Collapse } from "@/components/heymoa/collapse";
import { ShowMoreButton } from "@/components/heymoa/show-more-button";
import { AddItemForm } from "@/components/notes/review/add-item-form";
import { ReviewRow, ROW_GRID, type ItemPatch } from "@/components/notes/review/review-row";
import { SectionBlock } from "@/components/notes/review/section-block";
import type { AssigneeChoice } from "@/lib/assignees/describe";
import { reviewSectionToMarkdown } from "@/lib/notes/review/markdown";
import {
  ASSIGNABLE_KINDS,
  REVIEW_SECTIONS,
  type ReviewItem,
  type ReviewKind,
  type ReviewSection as Section,
} from "@/lib/notes/review/sections";
import { cn } from "@/lib/utils";

const EMPTY_TEXT: Record<Section["key"], string> = {
  DECISION: "정한 것이 없습니다.",
  ACTION_ITEM: "할 일이 없습니다.",
  OPEN: "남은 이슈나 질문이 없습니다.",
  REFERENCE: "참고할 항목이 없습니다.",
};

/**
 * 한 섹션. 앞의 몇 줄만 서고 나머지는 「N개 더」로 접힌다 — 항목이 백 개 가까운 회의에서
 * 네 섹션을 다 펼치면 검토할 것이 스크롤 너머로 사라진다. 「참고」는 개수만 보이고 통째로 접힌다.
 */
export function ReviewSection({
  section,
  topicOf,
  topicTitleOf,
  topicTitle,
  canEdit,
  choices,
  openItemId,
  busyItemId,
  conflictItemId,
  adding,
  hint,
  aside,
  initialVisible = 5,
  onToggleItem,
  onSaveItem,
  onAddItem,
  onDismissConflict,
  renderDetail,
  suggestionsOf,
  isResolved,
}: {
  section: Section;
  topicOf: (itemId: string) => number | null;
  topicTitleOf: (ordinal: number) => string;
  /** 주제로 걸러 보는 중이면 그 제목. 복사본이 걸러진 목록이라고 밝힌다 */
  topicTitle: string | null;
  canEdit: boolean;
  choices: AssigneeChoice[];
  openItemId: string | null;
  busyItemId: string | null;
  conflictItemId: string | null;
  adding: boolean;
  hint?: ReactNode;
  aside?: ReactNode;
  initialVisible?: number;
  onToggleItem: (itemId: string) => void;
  onSaveItem: (itemId: string, patch: ItemPatch) => Promise<boolean>;
  onAddItem: (kind: ReviewKind, content: string) => Promise<boolean>;
  onDismissConflict: () => void;
  renderDetail: (item: ReviewItem) => ReactNode;
  /** 줄 아래에 늘 서는 제안 */
  suggestionsOf?: (item: ReviewItem) => ReactNode;
  /** 요약이 풀렸다고 짚은 이슈 · 질문인가 */
  isResolved?: (itemId: string) => boolean;
}) {
  const kinds = REVIEW_SECTIONS.find((row) => row.key === section.key)?.kinds ?? [];
  const assignable = kinds.every((kind) => ASSIGNABLE_KINDS.has(kind));
  const folded = section.key === "REFERENCE";
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  // 처음 그릴 때 있던 항목. 그 뒤에 생긴 줄만 스며들며 선다.
  const [initialIds] = useState(() => new Set(section.items.map((item) => item.itemId)));

  const head = folded ? [] : section.items.slice(0, initialVisible);
  const rest = folded ? section.items : section.items.slice(initialVisible);
  const showRest = expanded || rest.some((item) => item.itemId === openItemId);

  const row = (item: ReviewItem) => {
    const fresh = !initialIds.has(item.itemId);
    return (
      <ReviewRow
        key={item.itemId}
        item={item}
        topic={(() => {
          const ordinal = topicOf(item.itemId);
          return ordinal === null ? null : { ordinal, title: topicTitleOf(ordinal) };
        })()}
        assignable={assignable}
        open={openItemId === item.itemId}
        canEdit={canEdit}
        busy={busyItemId === item.itemId}
        locked={busyItemId !== null}
        conflict={conflictItemId === item.itemId}
        fresh={fresh}
        choices={choices}
        onToggle={() => onToggleItem(item.itemId)}
        onSave={(patch) => onSaveItem(item.itemId, patch)}
        onDismissConflict={onDismissConflict}
        suggestions={suggestionsOf?.(item)}
        resolved={isResolved?.(item.itemId) ?? false}
      >
        {openItemId === item.itemId ? renderDetail(item) : null}
      </ReviewRow>
    );
  };

  return (
    <SectionBlock
      title={section.label}
      count={section.includedCount}
      copy={{
        build: () => reviewSectionToMarkdown(section, topicTitle),
        disabled: section.includedCount === 0,
      }}
    >
      {hint || aside ? (
        <div className="flex min-h-[30px] flex-wrap items-center gap-x-2.5 text-xs text-[var(--el-muted)]">
          {hint ? <span>{hint}</span> : null}
          {aside ? <span className="ml-auto flex items-center gap-2.5">{aside}</span> : null}
        </div>
      ) : null}

      {assignable && section.items.length > 0 ? (
        <div
          className={cn(
            "hidden h-[30px] items-center gap-x-3 border-b border-[var(--el-hairline)] text-[11px] font-medium text-[var(--el-muted-soft)] sm:grid",
            ROW_GRID.assignable
          )}
        >
          <span>내용</span>
          <span>담당</span>
          <span>기한</span>
          <span />
        </div>
      ) : null}

      {section.items.length === 0 ? (
        <p className="py-1.5 text-[13px] text-[var(--el-muted-soft)]">{EMPTY_TEXT[section.key]}</p>
      ) : null}

      {head.map(row)}

      {folded && section.items.length > 0 ? (
        <button
          type="button"
          aria-expanded={showRest}
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-control py-1.5 text-left text-[12.5px] text-[var(--el-body)] hover:text-[var(--el-ink)]"
        >
          {section.kindCounts.map((row) => (
            <span key={row.kind}>
              {row.label} <span className="tabular-nums">{row.count}</span>
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-[var(--el-muted)]">
            {showRest ? "접기" : "펼치기"}
            <ChevronDown
              aria-hidden
              className={cn("size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none", showRest && "rotate-180")}
            />
          </span>
        </button>
      ) : null}

      <Collapse open={showRest} lazy>
        {rest.map(row)}
      </Collapse>

      {!folded && rest.length > 0 ? (
        <ShowMoreButton
          open={showRest}
          moreLabel={`${section.label} ${rest.length}개 더`}
          onToggle={() => setExpanded((value) => !value)}
          className="pt-2.5"
        />
      ) : null}

      {canEdit ? (
        composing ? (
          <AddItemForm
            kinds={kinds}
            busy={adding || busyItemId !== null}
            onCancel={() => setComposing(false)}
            onSubmit={async (kind, content) => {
              const added = await onAddItem(kind, content);
              if (added) {
                setComposing(false);
                setExpanded(true);
              }
              return added;
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="mt-1.5 flex items-center gap-1 text-[12.5px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
          >
            <Plus aria-hidden className="size-3.5" />
            {section.label} 추가
          </button>
        )
      ) : null}
    </SectionBlock>
  );
}
