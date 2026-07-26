import { formatAppDate, getAppDateKey } from "@/lib/format/date";

/**
 * 노트 목록의 날짜 묶음.
 *
 * **날짜 하나가 묶음 하나다.** `오늘`·`지난주` 같은 상대 라벨을 쓰지 않는다 — 회의는 "언제
 * 열렸나"로 찾는 기록이라 요일이 있는 실제 날짜가 훑기에 낫고, 상대 라벨은 시간이 지나면
 * 같은 회의가 다른 이름으로 불린다.
 *
 * 행 우측의 상대 시각(`13시간 전`)은 그대로 둔다 — 그건 "얼마나 최근인가"를 말하고
 * 이 헤더는 "언제인가"를 말한다.
 */
export type NoteGroup<T> = {
  key: string;
  label: string;
  notes: T[];
};

/**
 * `2026년 7월 27일 (월)`. 타임존은 `formatAppDate`가 고정한다(hydration).
 *
 * 요일을 `Intl`에 함께 넘기면 괄호 없이 `27일 월`로 붙어 읽기 나쁘다 — 따로 뽑아 조립한다.
 */
function labelFor(iso: string): string {
  const date = formatAppDate(iso, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const weekday = formatAppDate(iso, { weekday: "short" });

  return `${date} (${weekday})`;
}

/**
 * 이미 정렬된 노트를 날짜별로 묶는다. **정렬을 여기서 하지 않는다** — 순서의 주인은
 * `sortNotesByRecency` 하나이고, 여기서 또 정렬하면 두 곳이 갈린다.
 *
 * 묶음 기준은 앱 타임존(KST)의 날짜다. UTC로 자르면 자정 근처 회의가 하루 밀린다.
 */
export function groupNotesByRecency<T extends { updatedAt: string }>(
  sortedNotes: T[]
): NoteGroup<T>[] {
  const groups: NoteGroup<T>[] = [];

  for (const note of sortedNotes) {
    const key = getAppDateKey(note.updatedAt);
    const last = groups.at(-1);

    if (last && last.key === key) {
      last.notes.push(note);
      continue;
    }
    groups.push({ key, label: labelFor(note.updatedAt), notes: [note] });
  }

  return groups;
}
