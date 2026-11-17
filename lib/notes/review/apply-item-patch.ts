import type {
  MeetingReviewResponseData,
  MeetingReviewResponseDataItemsItem,
  UpdateMeetingReviewItemRequest,
} from "@/lib/api/generated/models";

type ItemPatch = Omit<
  UpdateMeetingReviewItemRequest,
  "expectedReviewVersion" | "expectedItemRevision"
>;

export function applyItemPatch(
  review: MeetingReviewResponseData,
  itemId: string,
  patch: ItemPatch
): MeetingReviewResponseData {
  const choiceOf = new Map(
    (patch.decisions ?? []).map((choice) => [choice.targetId, choice] as const)
  );
  const patchItem = (
    item: MeetingReviewResponseDataItemsItem
  ): MeetingReviewResponseDataItemsItem => ({
    ...item,
    ...(patch.included !== undefined ? { included: patch.included } : {}),
    ...(patch.projectSelected !== undefined
      ? { projectSelected: patch.projectSelected }
      : {}),
    ...(patch.included === false ? { projectSelected: false } : {}),
    ...("due" in patch ? { due: patch.due ?? null } : {}),
    ...(choiceOf.size > 0
      ? {
          replacements: item.replacements.map((row) => {
            const decision = choiceOf.get(row.target.itemId)?.decision;
            return decision === undefined ||
              decision === "APPLIED" ||
              decision === "APPLY"
              ? row
              : { ...row, decision };
          }),
          taskChanges: item.taskChanges.map((row) => {
            const choice = choiceOf.get(row.target.itemId);
            const decision = choice?.decision;
            return decision === undefined ||
              decision === "END" ||
              decision === "APPLIED"
              ? row
              : {
                  ...row,
                  decision,
                  draft:
                    decision === null
                      ? null
                      : choice?.taskChange
                        ? {
                            expectedRevision:
                              choice.taskChange.expectedRevision,
                            status: choice.taskChange.status ?? null,
                            assignee: choice.taskChange.assignee?.value
                              ? {
                                  value: {
                                    type: choice.taskChange.assignee.value.type,
                                    id:
                                      choice.taskChange.assignee.value.id ??
                                      null,
                                    label:
                                      choice.taskChange.assignee.value.label ??
                                      null,
                                  },
                                }
                              : (choice.taskChange.assignee ?? null),
                            due: choice.taskChange.due ?? null,
                          }
                        : row.draft,
                };
          }),
        }
      : {}),
  });
  return {
    ...review,
    items: review.items.map((item) =>
      item.itemId === itemId ? patchItem(item) : item
    ),
  };
}

export function restoreItemFields(
  current: MeetingReviewResponseData,
  before: MeetingReviewResponseDataItemsItem,
  patch: ItemPatch
): MeetingReviewResponseData {
  const touched = new Set(
    (patch.decisions ?? [])
      .filter(
        (choice) => choice.decision !== "APPLIED" && choice.decision !== "APPLY"
      )
      .map((choice) => choice.targetId)
  );
  const touchedTasks = new Set(
    (patch.decisions ?? [])
      .filter(
        (choice) => choice.decision !== "APPLIED" && choice.decision !== "END"
      )
      .map((choice) => choice.targetId)
  );
  return {
    ...current,
    items: current.items.map((item) =>
      item.itemId !== before.itemId
        ? item
        : item.revision !== before.revision
          ? item
          : {
              ...item,
              ...(patch.included !== undefined
                ? { included: before.included }
                : {}),
              ...("projectSelected" in patch || "included" in patch
                ? { projectSelected: before.projectSelected }
                : {}),
              ...("due" in patch ? { due: before.due } : {}),
              ...(touched.size > 0 || touchedTasks.size > 0
                ? {
                    replacements: item.replacements.map((row) => {
                      const old = before.replacements.find(
                        (candidate) =>
                          candidate.target.itemId === row.target.itemId
                      );
                      return touched.has(row.target.itemId) && old
                        ? { ...row, decision: old.decision }
                        : row;
                    }),
                    taskChanges: item.taskChanges.map((row) => {
                      const old = before.taskChanges.find(
                        (candidate) =>
                          candidate.target.itemId === row.target.itemId
                      );
                      return touchedTasks.has(row.target.itemId) && old
                        ? { ...row, decision: old.decision, draft: old.draft }
                        : row;
                    }),
                  }
                : {}),
            }
    ),
  };
}
