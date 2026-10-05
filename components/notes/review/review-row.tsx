"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AssigneeCell } from "@/components/heymoa/assignee-cell";
import { Collapse } from "@/components/heymoa/collapse";
import { DueCell } from "@/components/heymoa/due-cell";
import { ARRIVE_CLASS } from "@/components/heymoa/motion";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import { Button } from "@/components/ui/button";
import { assigneeRequestOf, type AssigneeChoice } from "@/lib/assignees/describe";
import { CONFLICT_MESSAGE } from "@/lib/api/error-message";
import type { UpdateMeetingReviewItemRequest } from "@/lib/api/generated/models";
import type { ReviewItem } from "@/lib/notes/review/sections";
import { topicNumber } from "@/lib/notes/review/topics";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

export type ItemPatch = Omit<
  UpdateMeetingReviewItemRequest,
  "expectedReviewVersion" | "expectedItemRevision"
>;

export type RowTopic = { ordinal: number; title: string };

/**
 * 검토 항목 한 줄(APP-865). 결정은 `체크 · 내용 · 주제 · 나온 때`, 할 일은 `상자 · 내용 · 담당 · 기한` 이다.
 * 줄 어디를 눌러도 펼쳐진다(내용 버튼이 줄을 덮는다) — 담당 · 기한 칸만 그 위에 떠서 바로 고친다.
 * 펼치면 근거 발언과 수정 · 제외가 서고, 제안은 펼치지 않아도 줄 아래에 선다. 뺀 항목은 자리를 지킨 채
 * 흐려진다 — 되살릴 수 있어야 한다.
 */
export function ReviewRow({
  item,
  topic,
  assignable,
  whenMs = null,
  mine = false,
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
}: {
  item: ReviewItem;
  topic: RowTopic | null;
  /** 담당 · 기한을 받는 줄(할 일) */
  assignable: boolean;
  /** 회의에서 나온 때(ms). 인용으로 계산하고 모르면 null */
  whenMs?: number | null;
  /** 담당이 보는 사람 자신이다 */
  mine?: boolean;
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
}) {
  const [editing, setEditing] = useState(false);
  const cellsEditable = canEdit && item.included && !busy && !locked;

  return (
    <div
      data-item-id={item.itemId}
      className={cn(
        "scroll-mt-24 border-b border-[var(--el-hairline-soft)]",
        fresh && ARRIVE_CLASS
      )}
    >
      <div
        className={cn(
          "relative -mx-2 grid items-center gap-x-3 rounded-control px-2 py-[11px] transition-colors duration-200 ease-out",
          assignable
            ? "grid-cols-[16px_minmax(0,1fr)_16px] sm:grid-cols-[16px_minmax(0,1fr)_132px_150px_16px]"
            : "grid-cols-[16px_minmax(0,1fr)_auto_16px]",
          open ? "bg-[var(--el-surface-strong)]" : "hover:bg-[var(--el-canvas-soft)]"
        )}
      >
        {assignable ? (
          <span aria-hidden className="size-4 rounded-[4px] border-[1.5px] border-[var(--el-hairline-strong)]" />
        ) : (
          <span aria-hidden className="flex">
            <TimelineToneIcon tone="decision" />
          </span>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          // 버튼이 줄 전체를 덮는다(::after) — 주제 · 때 자리를 눌러도 펼쳐진다. 이름은 내용 그대로다.
          className="min-w-0 rounded-chip text-left after:absolute after:inset-0 after:rounded-control after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)]"
        >
          <span
            className={cn(
              "block text-[15px] leading-6 text-[var(--el-ink)] transition-colors duration-200 ease-out",
              open ? "font-semibold break-keep" : "truncate",
              !item.included && "text-[var(--el-muted-soft)] line-through"
            )}
          >
            {item.content}
          </span>
        </button>
        {assignable ? (
          // 넓은 화면에서는 상자가 사라져(`contents`) 두 칸이 열에 선다. 좁은 화면에서는 둘째 줄이다.
          // 줄을 덮는 버튼 위에 떠야 눌린다.
          <div className="relative z-10 col-[2/-1] row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 pt-1.5 sm:contents">
            <span className="flex min-w-0 items-center gap-1.5 sm:relative sm:z-10">
              <AssigneeCell
                value={item.assignee}
                choices={choices}
                editable={cellsEditable}
                placeholder={cellsEditable ? "담당 정하기" : ""}
                onChange={(choice) => void onSave({ assignee: assigneeRequestOf(choice) })}
              />
              {mine ? (
                <span className="inline-flex h-[18px] shrink-0 items-center rounded-[5px] bg-[var(--el-surface-strong)] px-[5px] text-[11px] text-[var(--el-muted)]">
                  나
                </span>
              ) : null}
            </span>
            <span className="flex sm:relative sm:z-10">
              <DueCell
                value={item.due}
                chip
                editable={cellsEditable}
                onChange={(due) => void onSave({ due })}
              />
            </span>
          </div>
        ) : (
          <span className="flex min-w-0 items-center justify-end gap-3">
            {topic ? (
              <span
                title={`주제 ${topicNumber(topic.ordinal)} · ${topic.title}`}
                className="hidden max-w-[180px] truncate text-[12.5px] text-[var(--el-muted-soft)] sm:block"
              >
                {topic.title}
              </span>
            ) : null}
            {whenMs !== null ? (
              <span className="inline-flex h-[22px] items-center rounded-[6px] bg-[var(--el-canvas-soft)] px-[7px] text-xs tabular-nums text-[var(--el-body)]">
                {formatOffset(whenMs)}
              </span>
            ) : null}
          </span>
        )}
        <span
          aria-hidden
          className={cn(
            "flex justify-end text-[var(--el-muted-soft)]",
            assignable && "col-start-3 row-start-1 sm:col-start-5"
          )}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200 ease-out motion-reduce:transition-none",
                open && "rotate-180 text-[var(--el-ink)]"
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

      {suggestions ? <div className="space-y-1.5 pb-2.5 sm:pl-7">{suggestions}</div> : null}

      <Collapse open={open} lazy>
        <div className="space-y-2.5 pt-1 pb-3.5 sm:pl-7">
          {children}
          <ItemState item={item} />
          {canEdit || editing ? (
            editing ? (
              <ContentEditor
                initial={item.content}
                busy={busy}
                disabled={!canEdit}
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
  disabled,
  onSubmit,
  onCancel,
}: {
  initial: string;
  busy: boolean;
  disabled: boolean;
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
        if (trimmed && !disabled) void onSubmit(trimmed);
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
            if (trimmed && !disabled) void onSubmit(trimmed);
          }
        }}
        className="block w-full resize-none bg-transparent text-sm leading-6 text-[var(--el-ink)] outline-none [field-sizing:content]"
      />
      <div className="mt-2 flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" size="sm" loading={busy} disabled={!trimmed || disabled}>
          저장
        </Button>
      </div>
    </form>
  );
}
