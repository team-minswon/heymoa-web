"use client";

import { CalendarDays } from "lucide-react";
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
  chip = false,
  quiet = false,
  onChange,
  className,
}: {
  value: string | null;
  placeholder?: string;
  editable?: boolean;
  overdue?: boolean;
  label?: string;
  /**
   * 달력 아이콘이 붙은 칩 모양(검토 화면 · APP-865). 기한이 없으면 점선 테두리의 「기한 정하기」라
   * 정해야 할 것이 남았다는 것이 눈에 띈다.
   */
  chip?: boolean;
  /** 표 안의 칸이면 빈 값을 달력 아이콘으로만 두고 글은 줄(`group`)을 가리키거나 포커스가 들 때 세운다. 좁은 화면은 늘 보인다 */
  quiet?: boolean;
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
  const chipClass = value
    ? "bg-[var(--el-canvas-soft)] text-[var(--el-body)]"
    : "border border-dashed border-[#efc2a8] text-[#b4501f]";
  const content = chip ? (
    <>
      <CalendarDays aria-hidden className="size-[13px] shrink-0" />
      {text}
    </>
  ) : quiet && !value ? (
    <span className="inline-flex items-center">
      <CalendarDays aria-hidden className="size-[14px] shrink-0 text-[var(--el-muted)]" />
      {/* 기한 칸은 오른쪽 끝에 붙는다. 투명하게만 두면 보이지 않는 글 폭만큼 아이콘이 왼쪽에 떠서, 폭째 접었다 편다. */}
      <span className="ml-1.5 overflow-hidden whitespace-nowrap text-[var(--el-muted)] transition-[max-width,opacity,margin] duration-150 ease-out motion-reduce:transition-none sm:ml-0 sm:max-w-0 sm:opacity-0 sm:group-hover:ml-1.5 sm:group-hover:max-w-24 sm:group-hover:opacity-100 sm:group-focus-within:ml-1.5 sm:group-focus-within:max-w-24 sm:group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  ) : (
    text
  );

  if (!editable) {
    if (chip) {
      return value ? (
        <span className={cn("inline-flex h-[26px] items-center gap-1.5 rounded-[7px] px-[9px] text-[13px] whitespace-nowrap tabular-nums", chipClass, className)}>
          {content}
        </span>
      ) : null;
    }
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
          chip
            ? cn(
                "inline-flex h-9 items-center gap-1.5 rounded-[7px] px-[9px] text-[13px] whitespace-nowrap tabular-nums hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] sm:h-[26px]",
                chipClass
              )
            : cn(
                "inline-flex h-9 items-center rounded-control px-1.5 -mx-1.5 text-[13px] tabular-nums hover:bg-[var(--el-surface-strong)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] sm:h-7",
                tone
              )
        )}
        onClick={() => {
          const node = input.current;
          if (!node) return;
          if (typeof node.showPicker === "function") node.showPicker();
          else node.focus();
        }}
      >
        {content}
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
