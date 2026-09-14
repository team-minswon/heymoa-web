"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AssigneeCell } from "@/components/heymoa/assignee-cell";
import { Collapse } from "@/components/heymoa/collapse";
import { DueCell } from "@/components/heymoa/due-cell";
import { ARRIVE_CLASS } from "@/components/heymoa/motion";
import { Button } from "@/components/ui/button";
import { assigneeRequestOf, type AssigneeChoice } from "@/lib/assignees/describe";
import { CONFLICT_MESSAGE } from "@/lib/api/error-message";
import type { UpdateMeetingReviewItemRequest } from "@/lib/api/generated/models";
import type { ReviewItem } from "@/lib/notes/review/sections";
import { topicNumber } from "@/lib/notes/review/topics";
import { cn } from "@/lib/utils";

export type ItemPatch = Omit<
  UpdateMeetingReviewItemRequest,
  "expectedReviewVersion" | "expectedItemRevision"
>;

/**
 * 담당 · 기한 칸이 있는 줄과 없는 줄. 표 머리와 줄이 같은 값을 써야 칸이 맞는다.
 * 좁은 화면에서는 두 칸이 내용 아래 줄로 내려간다 — 고정 폭 칸이 옆에 서면 내용이 한 글자 폭으로 준다.
 */
export const ROW_GRID = {
  // 할 일에는 주제 칸을 두지 않는다 — 담당 · 기한 칸과 함께 서면 내용이 가려진다.
  assignable: "grid-cols-[minmax(0,1fr)_14px] sm:grid-cols-[minmax(0,1fr)_128px_108px_14px]",
  plain: "grid-cols-[minmax(0,1fr)_auto_14px] sm:grid-cols-[minmax(0,1fr)_132px_14px]",
} as const;

export type RowTopic = { ordinal: number; title: string };

/**
 * 검토 항목 한 줄. 누르면 아래로 펼쳐져 제안과 수정 기록이 서고, 담당 · 기한은 펼치지 않고도
 * 칸에서 바로 고친다. 뺀 항목은 자리를 지킨 채 흐려진다 — 되살릴 수 있어야 한다.
 */
export function ReviewRow({
  item,
  topic,
  assignable,
  open,
  canEdit,
  busy,
  locked = false,
  conflict,
  fresh,
  choices,
  onToggle,
  onSave,
  onDismissConflict,
  children,
  suggestions,
  resolved = false,
}: {
  item: ReviewItem;
  topic: RowTopic | null;
  assignable: boolean;
  open: boolean;
  canEdit: boolean;
  busy: boolean;
  /** 다른 항목이 저장 중이다. 검토본 저장은 한 번에 하나라, 풀어 두면 누른 조작이 조용히 버려진다 */
  locked?: boolean;
  conflict: boolean;
  /** 방금 더한 항목. 한 번 스며들며 선다 */
  fresh: boolean;
  choices: AssigneeChoice[];
  onToggle: () => void;
  onSave: (patch: ItemPatch) => Promise<boolean>;
  onDismissConflict: () => void;
  children?: ReactNode;
  /** 줄을 펼치지 않아도 서는 제안. 사람이 골라야 하는 것이라 접어 두지 않는다 */
  suggestions?: ReactNode;
  /** 요약이 이 회의에서 풀렸다고 짚은 이슈 · 질문. 담당 · 기한 칸 자리에 「해결됨」이 선다 */
  resolved?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const cellsEditable = canEdit && item.included && !busy && !locked && !resolved;

  return (
    <div
      data-item-id={item.itemId}
      className={cn(
        "border-b border-[var(--el-hairline-soft)] last:border-b-0",
        fresh && ARRIVE_CLASS
      )}
    >
      <div
        className={cn(
          "-mx-2 grid min-h-10 items-center gap-x-3 rounded-control px-2 transition-colors duration-200 ease-out",
          assignable ? ROW_GRID.assignable : ROW_GRID.plain,
          open ? "bg-[var(--el-surface-strong)]" : "hover:bg-[var(--el-canvas-soft)]"
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="min-w-0 rounded-chip py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)]"
        >
          <span
            className={cn(
              "block text-sm text-[var(--el-ink)] transition-colors duration-200 ease-out",
              open ? "font-semibold break-keep" : "truncate",
              (!item.included || resolved) && "text-[var(--el-muted-soft)] line-through"
            )}
          >
            {item.content}
          </span>
        </button>
        {assignable && resolved ? (
          <span className="col-span-full row-start-2 pb-2 text-[13px] text-[var(--el-muted-soft)] sm:col-span-2 sm:row-start-auto sm:pb-0">
            해결됨
          </span>
        ) : assignable ? (
          // 넓은 화면에서는 상자가 사라져(`contents`) 두 칸이 표의 열에 선다. 좁은 화면에서는 둘째 줄이다.
          <div className="col-span-full row-start-2 flex min-w-0 flex-wrap items-center gap-x-4 pb-2 sm:contents">
            <AssigneeCell
              value={item.assignee}
              choices={choices}
              editable={cellsEditable}
              placeholder={cellsEditable ? "담당 정하기" : ""}
              onChange={(choice) => void onSave({ assignee: assigneeRequestOf(choice) })}
            />
            <DueCell
              value={item.due}
              editable={cellsEditable}
              onChange={(due) => void onSave({ due })}
            />
          </div>
        ) : null}
        {/* 번호만으로는 어느 주제인지 모른다. 넓은 화면에서는 짧은 제목을 함께, 좁은 화면에서는 번호만 둔다. */}
        {assignable ? null : (
          <span
            title={topic ? `주제 ${topicNumber(topic.ordinal)} · ${topic.title}` : undefined}
            className="flex min-w-0 items-baseline justify-end gap-1.5 text-[11.5px] text-[var(--el-muted)]"
          >
            {topic ? (
              <>
                <span className="font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)]">
                  {topicNumber(topic.ordinal)}
                </span>
                <span className="hidden truncate sm:inline">{topic.title}</span>
              </>
            ) : null}
          </span>
        )}
        <span aria-hidden className="flex justify-end text-[var(--el-muted-soft)]">
          {busy ? (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none",
                open ? "text-[var(--el-ink)]" : "-rotate-90"
              )}
            />
          )}
        </span>
      </div>

      {/* 거절을 한 번이라도 겪은 줄만 안내를 만든다. 줄마다 숨은 알림을 두면 스크린 리더가 줄 수만큼 읽는다. */}
      <Collapse open={conflict} lazy>
        <div
          role="alert"
          className="my-1.5 flex items-center gap-3 rounded-control bg-[var(--el-canvas-soft)] px-3 py-2 text-[12.5px] text-[var(--el-body)]"
        >
          <span className="min-w-0 flex-1">
            {CONFLICT_MESSAGE}
          </span>
          <button
            type="button"
            className="shrink-0 text-[var(--el-muted)] underline underline-offset-2"
            onClick={onDismissConflict}
          >
            닫기
          </button>
        </div>
      </Collapse>

      {suggestions ? <div className="space-y-1.5 pb-2.5 sm:pl-3">{suggestions}</div> : null}

      <Collapse open={open} lazy>
        <div className="space-y-2.5 pt-2 pb-3.5 sm:pl-3">
          <ItemState item={item} />
          {canEdit ? (
            editing ? (
              <ContentEditor
                initial={item.content}
                busy={busy}
                onCancel={() => setEditing(false)}
                onSubmit={async (content) => {
                  const saved = content === item.content || (await onSave({ content }));
                  if (saved) setEditing(false);
                }}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {item.included ? (
                  <Button variant="outline" size="xs" disabled={busy || locked} onClick={() => setEditing(true)}>
                    수정
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="xs"
                  disabled={busy || locked}
                  onClick={() => void onSave({ included: !item.included })}
                >
                  {item.included ? "제외" : "제외 취소"}
                </Button>
              </div>
            )
          ) : null}
          {children}
        </div>
      </Collapse>
    </div>
  );
}

function ItemState({ item }: { item: ReviewItem }) {
  const notes = [
    !item.included && "제외됨",
    item.edited && "수정됨",
    item.originalProposalRef === null && "직접 추가",
  ].filter(Boolean);
  if (notes.length === 0) return null;
  return <p className="text-xs text-[var(--el-muted)]">{notes.join(" · ")}</p>;
}

function ContentEditor({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: string;
  busy: boolean;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();
  return (
    <form
      className="rounded-control border border-[var(--el-ink)] bg-[var(--el-surface-card)] p-2.5 animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) void onSubmit(trimmed);
      }}
    >
      <textarea
        autoFocus
        aria-label="항목 내용"
        value={value}
        rows={1}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (trimmed) void onSubmit(trimmed);
          }
        }}
        className="block w-full resize-none bg-transparent text-sm leading-6 text-[var(--el-ink)] outline-none [field-sizing:content]"
      />
      <div className="mt-2 flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" size="sm" loading={busy} disabled={!trimmed}>
          저장
        </Button>
      </div>
    </form>
  );
}
