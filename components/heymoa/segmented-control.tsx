"use client";

import { cn } from "@/lib/utils";

/**
 * 한 화면 안에서 보기를 바꾸는 칸. 고른 칸 밑의 흰 판이 옆으로 미끄러진다 — 무엇이 바뀌었는지
 * 눈이 따라간다. 다른 화면으로 가는 것이 아니라서 탭이 아니라 라디오다.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  label,
  onChange,
  className,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  label: string;
  onChange: (next: T) => void;
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative inline-grid rounded-full bg-[var(--el-surface-strong)] p-0.5",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 rounded-full bg-[var(--el-surface-card)] shadow-[0_1px_2px_#0c0a0914] transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 h-7 rounded-full px-3.5 text-[12.5px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--el-ink)]",
              selected
                ? "text-[var(--el-ink)]"
                : "text-[var(--el-muted)] hover:text-[var(--el-ink)]"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
