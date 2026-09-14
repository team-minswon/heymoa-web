import type { ReactNode } from "react";

import { RoleDot, roleOfItem } from "@/components/notes/review/role-dot";
import type { ReviewItem } from "@/lib/notes/review/sections";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";
import { linkedItemsOf } from "@/lib/notes/review/topics";
import { cn } from "@/lib/utils";

/**
 * 펼친 항목의 속. 붙은 제안(있으면)이 먼저 서고, 그 아래 수정 기록 카드와 관련 항목이다.
 * 요약 보기에서는 줄 아래에 떠 있는 카드라 옅은 그림자를 두고, 그래프의 상세 패널 안에서는 카드 안의
 * 카드라 hairline 만 쓴다.
 */
export function ItemDetail({
  item,
  summary,
  itemsById,
  suggestions,
  trail,
  elevated = false,
  onSelectItem,
}: {
  item: ReviewItem;
  summary: MeetingReviewSummary | null;
  itemsById: ReadonlyMap<string, ReviewItem>;
  suggestions?: ReactNode;
  trail: ReactNode;
  elevated?: boolean;
  onSelectItem: (itemId: string) => void;
}) {
  const linked = linkedItemsOf(summary, item.itemId).flatMap((row) => {
    const other = itemsById.get(row.itemId);
    return other ? [{ ...row, other }] : [];
  });

  return (
    <div className="space-y-2">
      {suggestions}
      <div
        className={cn(
          "overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)]",
          elevated && "shadow-e2"
        )}
      >
        <div className="px-4 pt-3.5 pb-2.5">{trail}</div>
        {linked.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-[var(--el-hairline-soft)] px-4 py-2.5 text-xs text-[var(--el-muted)]">
            <span>관련 항목</span>
            {linked.map((row) => (
              <button
                key={row.itemId}
                type="button"
                onClick={() => onSelectItem(row.itemId)}
                className="inline-flex max-w-full min-w-0 items-center gap-1.5 text-[var(--el-ink)] hover:underline hover:underline-offset-2"
              >
                <RoleDot role={roleOfItem(row.other, summary)} />
                <span className="text-[var(--el-muted)]">{row.label}</span>
                <span className="truncate">{row.other.content}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
