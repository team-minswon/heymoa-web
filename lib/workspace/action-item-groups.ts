import type { ActionItem } from "@/lib/api/generated/models";

export type ActionItemGroupKey = "overdue" | "thisWeek" | "later" | "noDue";

export type ActionItemGroup = {
  key: ActionItemGroupKey;
  label: string;
  items: ActionItem[];
};

const LABEL: Record<ActionItemGroupKey, string> = {
  overdue: "지난 기한",
  thisWeek: "이번 주",
  later: "나중",
  noDue: "기한 없음",
};

const ORDER: ActionItemGroupKey[] = ["overdue", "thisWeek", "later", "noDue"];

/**
 * 「누가」보다 「언제까지」가 먼저 걸린다. 그래서 목록은 담당자가 아니라 기한으로 묶는다.
 *
 * 경계는 **시각**으로 판정한다 — 문자열 비교는 `+09:00` 오프셋을 잘못 가른다.
 * 기한 없음은 늘 마지막이다: 시간이 없는 것을 시간 순서 사이에 끼우면 순서가 거짓말을 한다.
 */
export function groupActionItemsByDue(
  items: readonly ActionItem[],
  now: number
): ActionItemGroup[] {
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  const buckets: Record<ActionItemGroupKey, ActionItem[]> = {
    overdue: [],
    thisWeek: [],
    later: [],
    noDue: [],
  };

  for (const item of items) {
    if (item.dueAt === null) {
      buckets.noDue.push(item);
      continue;
    }
    const due = Date.parse(item.dueAt);
    if (Number.isNaN(due)) {
      // 파싱 못 하는 값을 「지난 기한」으로 밀면 없는 긴급을 만든다.
      buckets.noDue.push(item);
    } else if (due < now) {
      buckets.overdue.push(item);
    } else if (due <= weekEnd) {
      buckets.thisWeek.push(item);
    } else {
      buckets.later.push(item);
    }
  }

  for (const key of ORDER) {
    buckets[key].sort(
      (a, b) =>
        (a.dueAt ? Date.parse(a.dueAt) : Infinity) -
          (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
        a.actionItemId.localeCompare(b.actionItemId)
    );
  }

  return ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    label: LABEL[key],
    items: buckets[key],
  }));
}
