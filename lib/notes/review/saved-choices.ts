import { isProjectIncluded } from "@/lib/notes/review/project-approval";
import type { ReviewItem } from "@/lib/notes/review/sections";

export function missingChoicesOf(item: ReviewItem) {
  const current = new Set([
    ...item.replacements.map((row) => row.target.itemId),
    ...item.taskChanges.map((row) => row.target.itemId),
  ]);
  return (item.decisions ?? []).filter((row) => !current.has(row.targetId));
}

export function hasMissingApply(item: ReviewItem) {
  return (
    isProjectIncluded(item) &&
    missingChoicesOf(item).some(
      (row) => row.decision === "END" || row.decision === "APPLY"
    )
  );
}
