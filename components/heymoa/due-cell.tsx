"use client";

import { useRef } from "react";

import { formatDueDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";

/**
 * 기한 칸. 누르면 브라우저의 날짜 고르기가 열리고, 비우면 기한이 없어진다.
 * 검토 화면의 할 일 · 이슈와 할 일 목록이 같은 칸을 쓴다.
 */
export function DueCell({
  value,
  placeholder = "기한 정하기",
  editable = false,
  overdue = false,
  label = "기한",
  onChange,
  className,
}: {
  value: string | null;
  placeholder?: string;
  editable?: boolean;
  overdue?: boolean;
  label?: string;
  onChange?: (next: string | null) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const text = value ? formatDueDate(value) : placeholder;
  const tone = value
    ? overdue
      ? "text-[var(--el-error-strong)]"
      : "text-[var(--el-ink)]"
    : "text-[var(--el-muted-soft)]";

  if (!editable) {
    return (
      <span className={cn("inline-flex h-7 items-center text-[13px] tabular-nums", tone, className)}>
        {value ? text : ""}
      </span>
    );
  }

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={value ? `${label} ${text} 바꾸기` : placeholder}
        className={cn(
          "inline-flex h-9 items-center rounded-control px-1.5 -mx-1.5 text-[13px] tabular-nums hover:bg-[var(--el-surface-strong)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] sm:h-7",
          tone
        )}
        onClick={() => {
          const node = input.current;
          if (!node) return;
          if (typeof node.showPicker === "function") node.showPicker();
          else node.focus();
        }}
      >
        {text}
      </button>
      {/* 날짜 고르기는 브라우저의 것을 쓴다. 칸의 모양만 우리가 그린다. */}
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value || null)}
      />
    </span>
  );
}
