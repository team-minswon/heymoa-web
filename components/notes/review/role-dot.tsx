import type { MeetingReviewSummary } from "@/lib/notes/review/summary";
import type { ReviewKind } from "@/lib/notes/review/sections";
import type { GraphRole } from "@/lib/notes/review/graph-model";
import { cn } from "@/lib/utils";

/**
 * 항목 역할의 색. 색각 이상에서도 갈리는지 검증한 네 색이고, 그래프 · 트리 · 관련 항목이
 * 같은 값을 쓴다. 역할은 색만으로 말하지 않는다 — 옆에 늘 이름이 선다.
 */
export const ROLE_COLOR: Record<GraphRole, string> = {
  DECISION: "#2a78d6",
  ACTION: "#1baf7a",
  OPEN: "#eb6834",
  REFERENCE: "#a8a29e",
};

export function roleOfItem(
  item: { itemId: string; kind: ReviewKind },
  summary: MeetingReviewSummary | null | undefined
): GraphRole {
  if (item.kind === "DECISION") return "DECISION";
  if (item.kind === "ACTION_ITEM") return "ACTION";
  if (
    (item.kind === "ISSUE" || item.kind === "QUESTION") &&
    (summary?.topics ?? []).some((topic) => topic.openItemIds.includes(item.itemId))
  ) {
    return "OPEN";
  }
  return "REFERENCE";
}

export function RoleDot({ role, className }: { role: GraphRole; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: ROLE_COLOR[role] }}
    />
  );
}
