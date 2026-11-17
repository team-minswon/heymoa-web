import type { TimelineTone } from "@/lib/notes/proposals/timeline";
import { cn } from "@/lib/utils";

export const TIMELINE_ROW_GRID = "grid grid-cols-[56px_40px_minmax(0,1fr)]";

export const TONE_TEXT: Record<TimelineTone, string> = {
  decision: "text-[#1d5fa8]",
  task: "text-[#13805a]",
  open: "text-[#b4501f]",
  answered: "text-[var(--el-muted)]",
  reference: "text-[var(--el-muted)]",
};

export const TONE_TITLE: Record<TimelineTone, string> = {
  decision: "font-medium text-[var(--el-ink)]",
  task: "font-medium text-[var(--el-ink)]",
  open: "text-[var(--el-ink)]",
  answered: "text-[var(--el-muted)]",
  reference: "text-[var(--el-body)]",
};

export function LiveChip({
  dotClassName,
  label,
}: {
  dotClassName?: string;
  label: string;
}) {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-[6px] bg-[var(--el-success)]/10 px-2 text-[12px] text-[var(--el-success-strong)]">
      <span
        className={cn(
          "size-1.5 rounded-full bg-[var(--el-success)]",
          dotClassName
        )}
      />
      {label}
    </span>
  );
}
