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
  assignable: boolean;
  whenMs?: number | null;
  mine?: boolean;
  open: boolean;
  canEdit: boolean;
  busy: boolean;
  locked?: boolean;
  conflict: boolean;
  conflictMessage?: string;
  fresh: boolean;
  choices: AssigneeChoice[];
  onToggle: () => void;
  onSave: (patch: ItemPatch) => Promise<boolean>;
  onDismissConflict: () => void;
  children?: ReactNode;
  suggestions?: ReactNode;
}) {
  const tError = useTranslations("errors");
  const t = useTranslations("notes.review.row");
  const tAction = useTranslations("common.actions");
  const [editing, setEditing] = useState(false);
  const editFormId = useId();
  const cellsEditable = canEdit && item.included;
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
            <TimelineToneIcon tone="task" />
          </span>
        ) : (
          <span aria-hidden className="flex h-6 items-center">
            <TimelineToneIcon tone="decision" />
          </span>
        )}
        {editing ? (
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
        {/* 펼치면 화살표가 회전(transform)해 줄을 덮는 버튼 위에 그려지므로 흘려보내지 않으면 화살표 자리만 눌리지 않는다. */}
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
  latest: string;
  bold: boolean;
  disabled: boolean;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("notes.review.row");
  const [value, setValue] = useState(initial);
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
