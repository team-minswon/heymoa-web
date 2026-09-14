import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** 앞의 몇 개만 세운 목록의 「N개 더 · 접기」. 검토 섹션과 주제 목차가 같은 모양으로 접힌다. */
export function ShowMoreButton({
  open,
  moreLabel,
  onToggle,
  className,
}: {
  open: boolean;
  moreLabel: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1 text-[12.5px] text-[var(--el-muted)] hover:text-[var(--el-ink)]",
        className
      )}
    >
      <ChevronDown
        aria-hidden
        className={cn(
          "size-[13px] transition-transform duration-200 ease-out motion-reduce:transition-none",
          open && "rotate-180"
        )}
      />
      {open ? "접기" : moreLabel}
    </button>
  );
}
