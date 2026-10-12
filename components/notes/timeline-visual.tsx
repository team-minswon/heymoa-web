import type { TimelineTone } from "@/lib/notes/proposals/timeline";
import { cn } from "@/lib/utils";

/**
 * 타임라인 줄의 시각 값 — 노트 타임라인 탭과 랜딩 시연이 같은 줄을 그린다. 랜딩이 타임라인 화면
 * 모듈 전체를 끌어오지 않게 `timeline-tone-icon.tsx` 처럼 따로 둔다.
 */

/** 시각 · 유형 아이콘 · 본문 세 칸. 받아 적는 줄과 스켈레톤도 같은 칸을 쓴다. */
export const TIMELINE_ROW_GRID = "grid grid-cols-[44px_40px_minmax(0,1fr)]";

/** 유형 이름의 색. 역할 색을 글자로 쓰면 흰 바탕에서 옅어서 한 단 진하게 둔다. */
export const TONE_TEXT: Record<TimelineTone, string> = {
  decision: "text-[#1d5fa8]",
  task: "text-[#13805a]",
  open: "text-[#b4501f]",
  answered: "text-[var(--el-muted)]",
  reference: "text-[var(--el-muted)]",
};

/** 줄 제목의 무게 · 색. */
export const TONE_TITLE: Record<TimelineTone, string> = {
  decision: "font-medium text-[var(--el-ink)]",
  task: "font-medium text-[var(--el-ink)]",
  open: "text-[var(--el-ink)]",
  answered: "text-[var(--el-muted)]",
  reference: "text-[var(--el-body)]",
};

/** 「논의 중」 칩. 기록 중인 회의의 마지막 안건에만 선다. 점 움직임은 `dotClassName` 으로 얹는다. */
export function LiveChip({ dotClassName }: { dotClassName?: string }) {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-[6px] bg-[var(--el-success)]/10 px-2 text-[12px] text-[var(--el-success-strong)]">
      <span
        className={cn(
          "size-1.5 rounded-full bg-[var(--el-success)]",
          dotClassName
        )}
      />
      논의 중
    </span>
  );
}
