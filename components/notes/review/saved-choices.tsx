"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ReviewItem } from "@/lib/notes/review/sections";
import { missingChoicesOf } from "@/lib/notes/review/saved-choices";

/** 과거 제안을 다시 만들지 않고, 저장된 선택만 확인하고 해제합니다. */
export function SavedChoices({
  item,
  disabled,
  onClear,
}: {
  item: ReviewItem;
  disabled: boolean;
  onClear: (targetId: string) => Promise<boolean>;
}) {
  const t = useTranslations("notes.review.savedChoices");
  const [clearing, setClearing] = useState<string | null>(null);
  return missingChoicesOf(item).map((choice, index) => {
    const decision = t(`decisions.${choice.decision}`);
    return (
      <div
        key={choice.targetId}
        role="group"
        aria-label={t("group", { index: index + 1 })}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-[var(--el-canvas-soft)] px-3 py-2.5 text-xs text-[var(--el-muted)]"
      >
        <span>{t("label", { decision })}</span>
        {choice.decision !== "APPLIED" ? (
          <Button
            variant="ghost"
            size="xs"
            data-clear-saved-choice
            aria-label={t("clearLabel", { decision, index: index + 1 })}
            disabled={disabled}
            loading={clearing === choice.targetId}
            onClick={async () => {
              setClearing(choice.targetId);
              try {
                await onClear(choice.targetId);
              } finally {
                setClearing(null);
              }
            }}
            className="ml-auto underline underline-offset-4"
          >
            {t("clear")}
          </Button>
        ) : null}
      </div>
    );
  });
}
