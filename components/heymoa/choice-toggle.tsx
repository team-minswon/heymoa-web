"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Choice } from "@/lib/notes/review/confirm";

/**
 * 제안을 받을지 고르는 두 칸. **바꾸는 쪽은 초록에 체크, 그대로 두는 쪽은 먹색이다.**
 * 빨강은 오류 색이라 고르는 값에 쓰지 않는다. 아직 안 골랐으면 둘 다 흐리다.
 */
export function ChoiceToggle({
  value,
  changeLabel,
  keepLabel = "유지",
  label,
  disabled = false,
  keepDisabled = false,
  onChange,
}: {
  value: Choice | null;
  changeLabel: string;
  keepLabel?: string;
  /** 무엇을 고르는지. 스크린 리더가 두 칸을 한 질문으로 읽는다 */
  label: string;
  disabled?: boolean;
  /** 「유지」만 막는다. 이미 바꾼 것을 되돌릴 수 없는데 유지라고 적히면 기록과 실제가 갈린다 */
  keepDisabled?: boolean;
  onChange: (next: Choice) => void;
}) {
  const option = (choice: Choice, text: string) => {
    const selected = value === choice;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled || (choice === "keep" && keepDisabled)}
        onClick={() => onChange(choice)}
        className={cn(
          "inline-flex h-[22px] items-center gap-1 rounded-full border border-transparent px-2.5 text-[11.5px] font-medium whitespace-nowrap text-[var(--el-muted)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--el-ink)] disabled:opacity-50",
          selected &&
            choice === "change" &&
            "border-[var(--el-success)]/30 bg-[var(--el-success)]/10 text-[var(--el-success-strong)]",
          selected &&
            choice === "keep" &&
            "bg-[var(--el-primary)] text-[var(--el-on-primary)]",
          !selected && "hover:text-[var(--el-ink)]"
        )}
      >
        {selected && choice === "change" ? (
          <Check aria-hidden className="size-[11px]" strokeWidth={3} />
        ) : null}
        {text}
      </button>
    );
  };

  return (
    <span
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 rounded-full bg-[var(--el-surface-strong)] p-0.5"
    >
      {option("change", changeLabel)}
      {option("keep", keepLabel)}
    </span>
  );
}
