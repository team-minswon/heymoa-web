"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ReviewItem } from "@/lib/notes/review/sections";
import { missingChoicesOf } from "@/lib/notes/review/saved-choices";

const LABEL = {
  END: "대체",
  APPLY: "반영 예정",
  KEEP: "유지",
  APPLIED: "반영됨",
} as const;

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
  const [clearing, setClearing] = useState<string | null>(null);
  return missingChoicesOf(item).map((choice, index) => (
    <div
      key={choice.targetId}
      role="group"
      aria-label={`이전 분석의 선택 ${index + 1}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-[var(--el-canvas-soft)] px-3 py-2.5 text-xs text-[var(--el-muted)]"
    >
      <span>이전 분석의 선택 · {LABEL[choice.decision]}</span>
      {choice.decision !== "APPLIED" ? (
        <Button
          variant="ghost"
          size="xs"
          data-clear-saved-choice
          aria-label={`${LABEL[choice.decision]} 선택 해제 ${index + 1}`}
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
          선택 해제
        </Button>
      ) : null}
    </div>
  ));
}
