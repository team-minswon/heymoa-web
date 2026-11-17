import { isProjectIncluded } from "@/lib/notes/review/project-approval";
import type { ReviewItem } from "@/lib/notes/review/sections";

export type Choice = "change" | "keep";

export const choiceOf = (
  decision: "END" | "APPLY" | "APPLIED" | "KEEP" | null
): Choice | null =>
  decision === null ? null : decision === "KEEP" ? "keep" : "change";

export type ConfirmBlock =
  | "saving"
  | "tasksLoading"
  | "tasksFailed"
  | "duplicateApplies"
  | "staleApplies"
  | "unchosen";

export function confirmBlockReason({
  saving,
  hasTaskChanges,
  tasks,
  unchosen,
  duplicateApplies = 0,
  staleApplies = 0,
}: {
  saving: boolean;
  hasTaskChanges: boolean;
  tasks: "pending" | "ready" | "failed";
  unchosen: number;
  duplicateApplies?: number;
  staleApplies?: number;
}): ConfirmBlock | null {
  if (saving) return "saving";
  if (hasTaskChanges && tasks === "pending") return "tasksLoading";
  if (hasTaskChanges && tasks === "failed") return "tasksFailed";
  if (duplicateApplies > 0) return "duplicateApplies";
  if (staleApplies > 0) return "staleApplies";
  if (unchosen > 0) return "unchosen";
  return null;
}

export function taskApplyConflictsOf(
  items: readonly ReviewItem[],
  revisionOf: (id: string) => number | undefined
) {
  const counts = new Map<string, number>();
  const stale = new Set<string>();
  for (const item of items) {
    if (!isProjectIncluded(item)) continue;
    for (const change of item.taskChanges) {
      if (change.decision !== "APPLY") continue;
      const id = change.target.itemId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (
        revisionOf(id) !==
        (change.draft?.expectedRevision ?? change.target.revision)
      )
        stale.add(id);
    }
  }
  return {
    duplicates: new Set(
      [...counts].filter(([, count]) => count > 1).map(([id]) => id)
    ),
    stale,
  };
}

export function unchosenSuggestionCount(
  items: readonly ReviewItem[],
  hasTask: (taskId: string) => boolean
) {
  return items
    .filter(isProjectIncluded)
    .reduce(
      (count, item) =>
        count +
        item.replacements.filter(
          (row) => row.decision === null && row.target.endedAt === null
        ).length +
        item.taskChanges.filter(
          (row) => row.decision === null && hasTask(row.target.itemId)
        ).length,
      0
    );
}

export type ConfirmSummary = {
  newTasks: number;
  endedDecisions: number;
  changedTasks: number;
};

export function confirmSummaryOf(items: readonly ReviewItem[]): ConfirmSummary {
  const included = items.filter(isProjectIncluded);
  const targets = (rows: ReadonlyArray<{ target: { itemId: string } }>) =>
    new Set(rows.map((row) => row.target.itemId)).size;
  return {
    newTasks: included.filter((item) => item.kind === "ACTION_ITEM").length,
    endedDecisions: targets(
      included.flatMap((item) =>
        item.replacements.filter(
          (row) => row.decision === "END" && row.target.endedAt === null
        )
      )
    ),
    changedTasks: targets(
      included.flatMap((item) =>
        item.taskChanges.filter((row) => row.decision === "APPLY")
      )
    ),
  };
}
