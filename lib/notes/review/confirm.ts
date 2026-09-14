import type { ReviewItem } from "@/lib/notes/review/sections";

/** 제안에 대해 고른 쪽. 바꾸는 쪽(반영 · 끝내기)이거나 유지다. */
export type Choice = "change" | "keep";

/** 서버에 저장된 선택(`END` · `APPLIED` · `KEEP`)을 두 칸 토글의 값으로 읽는다. 안 고른 제안은 비어 있다. */
export const choiceOf = (decision: "END" | "APPLIED" | "KEEP" | null): Choice | null =>
  decision === null ? null : decision === "KEEP" ? "keep" : "change";

/**
 * 지금 확정하면 안 되는 까닭. 없으면 null 이다. 확정은 되돌릴 수 없어 저장 · 기존 할 일 반영이 끝나고,
 * 포함 항목에 기존 할 일 변경 제안이 있으면 그 할 일을 읽어 사람이 볼 수 있어야 한다.
 */
export function confirmBlockReason({
  saving,
  applyingTasks,
  hasTaskChanges,
  tasks,
  unchosen,
}: {
  saving: boolean;
  applyingTasks: boolean;
  hasTaskChanges: boolean;
  tasks: "pending" | "ready" | "failed";
  /** 포함 항목에 붙었는데 아직 고르지 않은, 고를 수 있는 제안 수 */
  unchosen: number;
}): string | null {
  if (saving) return "저장이 끝나면 완료할 수 있습니다";
  if (applyingTasks) return "기존 할 일에 반영하는 중입니다";
  if (hasTaskChanges && tasks === "pending") return "기존 할 일 변경 제안을 불러오는 중입니다";
  if (hasTaskChanges && tasks === "failed") return "기존 할 일을 불러오지 못해 변경 제안을 확인할 수 없습니다";
  // 사람이 고르는 것은 제안뿐이다. 안 본 제안을 둔 채 되돌릴 수 없는 확정으로 넘기지 않는다.
  if (unchosen > 0) return `고르지 않은 제안이 ${unchosen}개 남았습니다`;
  return null;
}

/**
 * 포함 항목에 붙었는데 아직 고르지 않은 제안 수. 고를 수 없는 것은 세지 않는다 — 다른 확정이 이미 끝낸
 * 대체와, 대상 할 일을 찾지 못한 할 일 변경이다. 세면 확정이 영영 막힌다.
 */
export function unchosenSuggestionCount(items: readonly ReviewItem[], hasTask: (taskId: string) => boolean) {
  return items
    .filter((item) => item.included)
    .reduce(
      (count, item) =>
        count +
        item.replacements.filter((row) => row.decision === null && row.target.endedAt === null).length +
        item.taskChanges.filter((row) => row.decision === null && hasTask(row.target.itemId)).length,
      0
    );
}

export type ConfirmSummary = {
  newTasks: number;
  endedDecisions: number;
  changedTasks: number;
};

/**
 * 확정하면 무엇이 일어나는지. 서버는 포함 항목에 저장된 끝내기(`END`)만 끝내고 다른 확정이 먼저 끝낸 노드는
 * 건너뛰므로 여기서도 그것만 센다 — 고르지 않은 대체는 끝내지 않는다. 기존 할 일 변경은 반영을 누를 때 이미
 * 할 일에 저장된다.
 */
export function confirmSummaryOf(items: readonly ReviewItem[]): ConfirmSummary {
  const included = items.filter((item) => item.included);
  const targets = (rows: ReadonlyArray<{ target: { itemId: string } }>) =>
    new Set(rows.map((row) => row.target.itemId)).size;
  return {
    newTasks: included.filter((item) => item.kind === "ACTION_ITEM").length,
    endedDecisions: targets(included.flatMap((item) => item.replacements.filter((row) => row.decision === "END" && row.target.endedAt === null))),
    changedTasks: targets(included.flatMap((item) => item.taskChanges.filter((row) => row.decision === "APPLIED"))),
  };
}
