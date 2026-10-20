import type { ReviewItem } from "@/lib/notes/review/sections";

/** 현재 제안에서 사라져도 사람이 저장한 선택과 이미 반영된 이력은 남습니다. */
export function missingChoicesOf(item: ReviewItem) {
  const current = new Set([
    ...item.replacements.map((row) => row.target.itemId),
    ...item.taskChanges.map((row) => row.target.itemId),
  ]);
  return (item.decisions ?? []).filter((row) => !current.has(row.targetId));
}

export function hasMissingApply(item: ReviewItem) {
  return item.included && missingChoicesOf(item).some(
    (row) => row.decision === "END" || row.decision === "APPLY"
  );
}
