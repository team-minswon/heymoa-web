import {
  summaryTopics,
  type MeetingReviewSummary,
} from "@/lib/notes/review/summary";
import type { ReviewKind } from "@/lib/notes/review/sections";
import type { GraphRole } from "@/lib/notes/review/graph-model";
import { cn } from "@/lib/utils";

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
    summaryTopics(summary).some((topic) =>
      topic.openItemIds.includes(item.itemId)
    )
  ) {
    return "OPEN";
  }
  return "REFERENCE";
}

export function RoleDot({
  role,
  className,
}: {
  role: GraphRole;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: ROLE_COLOR[role] }}
    />
  );
}
