"use client";

import {
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { AssigneeCell } from "@/components/heymoa/assignee-cell";
import { Collapse } from "@/components/heymoa/collapse";
import { DueCell } from "@/components/heymoa/due-cell";
import { ARRIVE_CLASS } from "@/components/heymoa/motion";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import { requiresProjectSelection } from "@/lib/notes/review/project-approval";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  assigneeRequestOf,
  type AssigneeChoice,
} from "@/lib/assignees/describe";
import type { UpdateMeetingReviewItemRequest } from "@/lib/api/generated/models";
import type { ReviewItem } from "@/lib/notes/review/sections";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type ItemPatch = Omit<
  UpdateMeetingReviewItemRequest,
  "expectedReviewVersion" | "expectedItemRevision"
>;

/**
 * 검토 항목 한 줄(APP-865). 결정은 `체크 · 내용 · 주제 · 나온 때`, 할 일은 `상자 · 내용 · 담당 · 기한` 이다.
 * 줄 어디를 눌러도 펼쳐진다(내용 버튼이 줄을 덮는다) — 담당 · 기한 칸만 그 위에 떠서 바로 고친다.
 * 펼치면 근거 발언과 수정 · 제외가 서고, 제안은 펼치지 않아도 줄 아래에 선다. 뺀 항목은 자리를 지킨 채
 * 흐려진다 — 되살릴 수 있어야 한다.
 * 칸마다 첫 글줄 높이(24px) 상자 가운데에 서서, 글이 두 줄로 꺾여도 아이콘 · 시각 · 스위치가 첫 줄에 맞는다.
 * 담당 · 기한 칸을 한 줄에 펼칠지는 화면이 아니라 줄 폭(`@container/row`)이 정한다. 회의 정리 창을 옆에 연
 * 1024 화면에서 화면 기준(`sm:`)이면 내용 칸이 14px 로 짓눌렸다(APP-1569).
 */
export function ReviewRow({
  item,
  assignable,
  whenMs = null,
  mine = false,
  open,
  canEdit,
  busy,
  locked = false,
  conflict,
  conflictMessage,
  fresh,
  choices,
  onToggle,
  onSave,
  onDismissConflict,
  children,
  suggestions,
}: {
  item: ReviewItem;
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
  conflictMessage?: string;
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
  const tError = useTranslations("errors");
  const t = useTranslations("notes.review.row");
  const tAction = useTranslations("common.actions");
  const [editing, setEditing] = useState(false);
  const editFormId = useId();
  const cellsEditable = canEdit && item.included;
  // 저장은 한 번에 하나라 그동안 모든 줄을 잠근다. 칸을 비활성으로 바꾸면 스위치 · 칩이 한꺼번에 흐려지고
  // 「기한 정하기」가 사라졌다 돌아와 목록 전체가 다시 불리는 것처럼 보인다. 그래서 모양은 두고 조작만 막고(`inert`),
  // 저장이 0.3초를 넘길 때만 흐리게 한다(APP-1587).
  const frozen = busy || locked;

  return (
    <div
      data-item-id={item.itemId}
      data-item-scroll-target
      inert={frozen}
      className={cn(
        "@container/row scroll-mt-24 border-b border-[var(--el-hairline-soft)]",
        frozen &&
          "opacity-60 [transition:opacity_150ms_ease-out_300ms] motion-reduce:transition-none",
        fresh && ARRIVE_CLASS
      )}
    >
      <div
        className={cn(
          "relative -mx-2 grid items-start gap-x-3 rounded-control px-2 py-[11px] transition-colors duration-200 ease-out",
          assignable
            ? "grid-cols-[16px_minmax(0,1fr)_68px_16px] @xl/row:grid-cols-[16px_minmax(0,1fr)_132px_124px_68px_16px]"
            : "grid-cols-[16px_minmax(0,1fr)_auto_68px_16px]",
          editing
            ? "bg-[var(--el-surface-card)] ring-1 ring-[var(--el-ink)]"
            : open
              ? "bg-[var(--el-surface-strong)]"
              : "hover:bg-[var(--el-canvas-soft)]"
        )}
      >
        {assignable ? (
          <span aria-hidden className="flex h-6 items-center">
            {/* 주제 목록과 같은 할 일 아이콘이다. 빈 네모는 누르면 끝낼 수 있는 체크박스로 읽힌다(APP-1587). */}
            <TimelineToneIcon tone="task" />
          </span>
        ) : (
          <span aria-hidden className="flex h-6 items-center">
            <TimelineToneIcon tone="decision" />
          </span>
        )}
        {editing ? (
          // 글자가 있던 자리에서 바로 고친다. 글꼴 · 줄 높이가 같아 줄 높이가 그대로라 아래 줄이 밀리지 않는다(APP-1587).
          <InlineContentEditor
            formId={editFormId}
            initial={item.content}
            latest={item.content}
            bold={open}
            disabled={busy || !canEdit}
            onCancel={() => setEditing(false)}
            onSubmit={async (content) => {
              const saved =
                content === item.content || (await onSave({ content }));
              if (saved) setEditing(false);
            }}
          />
        ) : (
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
                "whitespace-normal break-words [overflow-wrap:anywhere]",
                open && "font-semibold",
                !item.included && "text-[var(--el-muted-soft)] line-through"
              )}
            >
              {item.content}
            </span>
          </button>
        )}
        {assignable ? (
          // 넓은 화면에서는 상자가 사라져(`contents`) 두 칸이 열에 선다. 좁은 화면에서는 둘째 줄이다.
          // 줄을 덮는 버튼 위에 떠야 눌린다.
          <div className="relative z-10 col-[2/-1] row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 pt-1.5 @xl/row:contents">
            <span className="flex min-w-0 items-center gap-1.5 @xl/row:relative @xl/row:z-10 @xl/row:h-6">
              <AssigneeCell
                value={item.assignee}
                choices={choices}
                editable={cellsEditable}
                placeholder={cellsEditable ? t("assigneePlaceholder") : ""}
                onChange={(choice) =>
                  void onSave({ assignee: assigneeRequestOf(choice) })
                }
              />
              {mine ? (
                <span className="inline-flex h-[18px] shrink-0 items-center rounded-[5px] bg-[var(--el-surface-strong)] px-[5px] text-[11px] text-[var(--el-muted)]">
                  {t("me")}
                </span>
              ) : null}
            </span>
            <span className="flex items-center @xl/row:relative @xl/row:z-10 @xl/row:h-6">
              <DueCell
                value={item.due}
                chip
                editable={cellsEditable}
                onChange={(due) => void onSave({ due })}
              />
            </span>
          </div>
        ) : (
          <span className="flex h-6 min-w-0 items-center justify-end gap-3">
            {whenMs !== null ? (
              <span className="text-xs tabular-nums text-[var(--el-muted)]">
                {formatOffset(whenMs)}
              </span>
            ) : null}
          </span>
        )}
        <span
          className={cn(
            "relative z-10 flex h-6 items-center justify-end gap-2",
            assignable && "col-start-3 row-start-1 @xl/row:col-start-5"
          )}
        >
          {editing ? (
            // 수정 중에는 같은 칸이 취소 · 저장이 된다. 칸 폭이 그대로라 옆 칸이 움직이지 않는다.
            <>
              <button
                type="button"
                aria-label={tAction("cancel")}
                onClick={() => setEditing(false)}
                className={ICON_BUTTON}
              >
                <X aria-hidden className="size-3.5" />
              </button>
              <button
                type="submit"
                form={editFormId}
                aria-label={tAction("save")}
                disabled={busy || !canEdit}
                className={cn(
                  ICON_BUTTON,
                  "bg-[var(--el-ink)] text-[var(--el-surface-card)] hover:bg-[var(--el-ink)] hover:text-[var(--el-surface-card)]"
                )}
              >
                <Check aria-hidden className="size-3.5" />
              </button>
            </>
          ) : (
            <>
              {/* 접힌 줄에도 고칠 수 있다는 표시를 둔다(APP-1569). 스위치 옆 고정 열이라 줄마다 같은 자리에 선다(APP-1587). */}
              {canEdit && item.included && !open ? (
                <button
                  type="button"
                  aria-label={t("editRow", { content: item.content })}
                  onClick={() => setEditing(true)}
                  className={ICON_BUTTON}
                >
                  <Pencil aria-hidden className="size-3.5" />
                </button>
              ) : null}
              {requiresProjectSelection(item.kind) ? (
                <Switch
                  aria-label={t("projectSwitch", { content: item.content })}
                  checked={item.projectSelected}
                  disabled={!cellsEditable}
                  onCheckedChange={(projectSelected) =>
                    void onSave({ projectSelected })
                  }
                />
              ) : null}
            </>
          )}
        </span>
        {/* 클릭은 줄을 덮는 버튼이 받는다. 펼치면 화살표가 회전(transform)해 그 버튼 위에 그려지므로
            흘려보내지 않으면 화살표 자리만 눌리지 않는다. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none flex h-6 items-center justify-end text-[var(--el-muted-soft)]",
            assignable && "col-start-4 row-start-1 @xl/row:col-start-6"
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
            {conflictMessage ?? tError("conflict")}
          </span>
          <button
            type="button"
            className="shrink-0 text-[var(--el-muted)] underline underline-offset-2"
            onClick={onDismissConflict}
          >
            {tAction("close")}
          </button>
        </div>
      </Collapse>

      <Collapse open={open} lazy>
        <div className="space-y-2.5 pt-1 pb-3.5 @sm/row:pl-7">
          {canEdit ? (
            <div className="-ml-2 flex items-center gap-2">
              {item.included ? (
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={t("edit")}
                  disabled={editing}
                  onClick={() => setEditing(true)}
                >
                  <Pencil aria-hidden className="size-3.5" />
                  {t("edit")}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void onSave({ included: !item.included })}
              >
                {item.included ? (
                  <Trash2 aria-hidden className="size-3.5" />
                ) : (
                  <Undo2 aria-hidden className="size-3.5" />
                )}
                {item.included ? t("exclude") : t("include")}
              </Button>
            </div>
          ) : null}
          <ItemState item={item} />
          {children}
        </div>
      </Collapse>
      {/* 제안 묶음은 있어도 그릴 것이 없을 수 있다(저장한 선택 없음 · 접힌 관계). 빈 상자가 아래 여백을
          차지하면 줄 높이가 줄마다 달라져서, 내용이 있을 때만 여백을 준다(APP-1587). */}
      {suggestions ? (
        <div className="space-y-1.5 has-[>:not(:empty)]:pb-2.5 @sm/row:pl-7">
          {suggestions}
        </div>
      ) : null}
    </div>
  );
}

function ItemState({ item }: { item: ReviewItem }) {
  const t = useTranslations("notes.review.row");
  const notes = [
    !item.included && t("excluded"),
    item.edited && t("edited"),
    item.originalProposalRef === null && t("authored"),
  ].filter(Boolean);
  if (notes.length === 0) return null;
  return <p className="text-xs text-[var(--el-muted)]">{notes.join(" · ")}</p>;
}

const ICON_BUTTON =
  "flex size-6 shrink-0 items-center justify-center rounded-chip text-[var(--el-muted)] transition-colors duration-200 ease-out hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)] disabled:pointer-events-none disabled:opacity-50";

/** 줄 내용 자리에 서는 입력. Enter 로 저장하고 Esc 로 닫는다. 저장 버튼은 같은 줄 끝 칸에서 이 폼을 보낸다. */
function InlineContentEditor({
  formId,
  initial,
  latest,
  bold,
  disabled,
  onSubmit,
  onCancel,
}: {
  formId: string;
  initial: string;
  /** 지금 서버의 내용. 쓰는 사이 다른 사람이 고치면 처음 값과 달라진다 */
  latest: string;
  /** 펼친 줄은 내용이 굵다. 같은 굵기여야 줄바꿈 자리가 안 바뀐다 */
  bold: boolean;
  disabled: boolean;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("notes.review.row");
  const [value, setValue] = useState(initial);
  // 쓰기 시작할 때의 내용. 입력이 원문을 가리므로, 그 사이 원문이 바뀌면 아래에 따로 보여 준다.
  const [startedFrom] = useState(initial);
  const trimmed = value.trim();
  const submit = () => {
    if (trimmed && !disabled) void onSubmit(trimmed);
  };
  return (
    <form
      id={formId}
      className="relative z-10 min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        autoFocus
        aria-label={t("contentLabel")}
        value={value}
        rows={1}
        readOnly={disabled}
        onFocus={(event) => {
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submit();
          }
        }}
        className={cn(
          "block w-full resize-none bg-transparent p-0 text-[15px] leading-6 text-[var(--el-ink)] outline-none [field-sizing:content] [overflow-wrap:anywhere]",
          bold && "font-semibold"
        )}
      />
      {latest !== startedFrom ? (
        <p className="mt-1 text-xs leading-5 break-words text-[var(--el-muted)]">
          {t("latestContent", { content: latest })}
        </p>
      ) : null}
    </form>
  );
}
