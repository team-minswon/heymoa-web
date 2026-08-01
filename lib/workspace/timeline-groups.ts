import type { NoteSummary } from "@/lib/api/generated/models";
import { APP_TIME_ZONE } from "@/lib/format/date";

export type TimelineGroup = {
  /** `2026-08` — 정렬과 key 에 쓴다. 표시용 라벨과 분리한다. */
  monthKey: string;
  label: string;
  notes: NoteSummary[];
};

/**
 * 회의가 시간축에 놓이는 시각. 예정이 있으면 그것이고, 없으면 만든 시각이다.
 *
 * 시작 시각(`meetingStartedAt`)을 쓰지 않는 이유는 **시작 전 회의가 축에서 사라지기
 * 때문**이다 — 타임라인이 답해야 하는 건 「무엇이 이어졌나」이고 예정도 그 사슬의 일부다.
 */
export function timelineAnchorOf(note: NoteSummary): string {
  return note.scheduledAt ?? note.createdAt;
}

function monthPartsOf(value: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return { year: byType.year, month: byType.month };
}

/**
 * 월로 묶고 최신이 위다. 라벨은 해가 바뀔 때만 연도를 붙인다 — 같은 해가 이어지는데
 * 매번 「2026년」을 반복하면 정작 해가 바뀌는 지점이 안 보인다.
 */
export function groupNotesByMonth(
  notes: readonly NoteSummary[],
  currentYear: string
): TimelineGroup[] {
  const buckets = new Map<string, NoteSummary[]>();

  for (const note of notes) {
    const { year, month } = monthPartsOf(timelineAnchorOf(note));
    const key = `${year}-${month}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(note);
    else buckets.set(key, [note]);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monthKey, rows]) => {
      const [year, month] = monthKey.split("-");
      return {
        monthKey,
        label:
          year === currentYear
            ? `${Number(month)}월`
            : `${year}년 ${Number(month)}월`,
        notes: [...rows].sort(
          (a, b) =>
            Date.parse(timelineAnchorOf(b)) - Date.parse(timelineAnchorOf(a)) ||
            b.noteId.localeCompare(a.noteId)
        ),
      };
    });
}
