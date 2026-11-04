"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ARRIVE_CLASS } from "@/components/heymoa/motion";
import { SegmentedControl } from "@/components/heymoa/segmented-control";
import { Button } from "@/components/ui/button";
import type { ReviewKind } from "@/lib/notes/review/sections";

/**
 * 섹션에 항목을 하나 더한다. 종류는 섹션이 정하고, 섹션에 종류가 여럿이면 고른다.
 * Enter 로 더하고 Shift+Enter 로 줄을 바꾸며, Esc 로 닫는다.
 */
export function AddItemForm({
  kinds,
  busy,
  disabled = false,
  onSubmit,
  onCancel,
}: {
  kinds: readonly ReviewKind[];
  busy: boolean;
  disabled?: boolean;
  onSubmit: (kind: ReviewKind, content: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const t = useTranslations("notes.review.addItem");
  const tKind = useTranslations("notes.kinds");
  const tAction = useTranslations("common.actions");
  const [kind, setKind] = useState<ReviewKind>(kinds[0]);
  const [content, setContent] = useState("");
  const trimmed = content.trim();

  const submit = async () => {
    if (!trimmed || busy || disabled) return;
    if (await onSubmit(kind, trimmed)) setContent("");
  };

  return (
    <form
      className={`mt-2 rounded-control border border-[var(--el-hairline)] bg-[var(--el-surface-card)] p-2.5 ${ARRIVE_CLASS}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {kinds.length > 1 ? (
        <SegmentedControl
          label={t("kindLabel")}
          value={kind}
          options={kinds.map((value) => ({ value, label: tKind(value) }))}
          onChange={setKind}
          className="mb-2"
        />
      ) : null}
      <textarea
        autoFocus
        aria-label={t("contentLabel")}
        placeholder={t("placeholder", { kind: tKind(kind) })}
        value={content}
        rows={1}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            void submit();
          }
        }}
        className="block w-full resize-none bg-transparent text-sm leading-6 text-[var(--el-ink)] outline-none [field-sizing:content] placeholder:text-[var(--el-muted-soft)]"
      />
      <div className="mt-2 flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {tAction("cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          loading={busy}
          disabled={!trimmed || disabled}
        >
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
