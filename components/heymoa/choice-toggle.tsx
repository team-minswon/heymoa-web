"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Choice } from "@/lib/notes/review/confirm";

export function ChoiceToggle({
  value,
  changeLabel,
  keepLabel,
  label,
  disabled = false,
  keepDisabled = false,
  changeDisabled = false,
  onChange,
}: {
  value: Choice | null;
  changeLabel: string;
  keepLabel: string;
  label: string;
  disabled?: boolean;
  keepDisabled?: boolean;
  changeDisabled?: boolean;
  onChange: (next: Choice) => void;
}) {
  const option = (choice: Choice, text: string) => {
    const selected = value === choice;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled || (choice === "keep" && keepDisabled) || (choice === "change" && changeDisabled)}
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
