import type {
  MeetingReviewResponseData,
  MeetingReviewResponseDataItemsItem,
  UpdateMeetingReviewItemRequest,
} from "@/lib/api/generated/models";

type ItemPatch = Omit<
  UpdateMeetingReviewItemRequest,
  "expectedReviewVersion" | "expectedItemRevision"
>;

/**
 * 검토 항목 저장을 **응답 전에** 화면에 먼저 거는 값 (APP-1033). 서버가 판(`reviewVersion`·항목 `revision`)을 올리는 것은
 * 응답이 오면 그 응답으로 갈아 끼우므로 여기서 건드리지 않는다.
 *
 * 걸리는 것은 **서버가 그 값을 그대로 받아 저장하는 칸**뿐이다 — 포함 여부, 기한, 대체·할 일 변경 제안의 선택.
 * 내용(서버가 정규화하고 `edited` 를 올린다)과 담당(요청에는 사람 식별자만 있고 이름은 서버가 푼다)은 걸지 않는다.
 */
export function applyItemPatch(
  review: MeetingReviewResponseData,
  itemId: string,
  patch: ItemPatch
): MeetingReviewResponseData {
  const decisionOf = new Map(
    (patch.decisions ?? []).map(
      (choice) => [choice.targetId, choice.decision] as const
    )
  );
  const patchItem = (
    item: MeetingReviewResponseDataItemsItem
  ): MeetingReviewResponseDataItemsItem => ({
    ...item,
    ...(patch.included !== undefined ? { included: patch.included } : {}),
    ...("due" in patch ? { due: patch.due ?? null } : {}),
    ...(decisionOf.size > 0
      ? {
          // 대체 제안은 END·KEEP, 할 일 변경 제안은 KEEP 만 건다. 할 일 변경의 APPLIED 는 할 일 API 로 먼저 반영한 뒤의 기록이라
          // (두 단계 저장, 되돌릴 수 없다) 응답을 기다리는 지금 방식 그대로 둔다.
          replacements: item.replacements.map((row) => {
            const decision = decisionOf.get(row.target.itemId);
            return decision === undefined || decision === "APPLIED"
              ? row
              : { ...row, decision };
          }),
          taskChanges: item.taskChanges.map((row) => {
            const decision = decisionOf.get(row.target.itemId);
            return decision === undefined ||
              decision === "END" ||
              decision === "APPLIED"
              ? row
              : { ...row, decision };
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

/**
 * `applyItemPatch` 로 먼저 건 칸을 **그 항목의 이전 값으로만** 되돌린다 (APP-1033). 저장이 실패했을 때 쓴다.
 * 검토본 전체 사본을 복원하면 그사이 다른 조회가 가져온 더 새 판(다른 사람이 더한 항목·바뀐 판)을 옛 값으로 덮는다.
 */
export function restoreItemFields(
  current: MeetingReviewResponseData,
  before: MeetingReviewResponseDataItemsItem,
  patch: ItemPatch
): MeetingReviewResponseData {
  // `applyItemPatch` 가 안 건 값(대체의 APPLIED, 할 일 변경의 END·APPLIED)은 되돌리지도 않는다 — 그 칸은 다른 길이 쓴 값이다.
  const touched = new Set(
    (patch.decisions ?? [])
      .filter((choice) => choice.decision !== "APPLIED")
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
        : // **그사이 더 새 판이 들어왔으면(다른 조회가 서버 값을 가져왔다) 되돌리지 않는다.** 새 판의 값은 서버의 값이라
          // 옛 값으로 되돌리면 존재하지 않는 조합(새 판 번호 + 옛 값)이 캐시에 남는다.
          item.revision !== before.revision
          ? item
          : {
              ...item,
              ...(patch.included !== undefined
                ? { included: before.included }
                : {}),
              ...("due" in patch ? { due: before.due } : {}),
              ...(touched.size > 0
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
                        ? { ...row, decision: old.decision }
                        : row;
                    }),
                  }
                : {}),
            }
    ),
  };
}
