import { getAppDateKey } from "@/lib/format/date";

/**
 * 노트 목록의 날짜 묶음. 라벨이 `null`이면 헤더 없이 한 덩어리로 그린다.
 *
 * **묶음은 `now`에 의존한다.** SSR에는 "오늘"이 없으므로 서버와 첫 클라이언트 렌더가
 * 갈리지 않도록 `now`가 없을 때는 묶지 않는다 — 상대 시각(`RelativeTime`)이 쓰는 방식과 같다.
 */
export type NoteGroup<T> = {
  key: string;
  label: string | null;
  notes: T[];
};

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD`를 일 단위 정수로. 타임존은 `getAppDateKey`가 이미 고정했다. */
function dayIndexOf(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / DAY_MS);
}

/**
 * 그 날짜가 속한 주의 월요일. **롤링 6일이 아니라 달력 주로 가른다** — 월요일에 지난 토요일
 * 노트는 "2일 전"이지만 지난주다. 1970-01-01이 목요일이므로 `+3`으로 월요일을 0에 맞춘다.
 */
function weekStartOf(dayIndex: number): number {
  return dayIndex - ((dayIndex + 3) % 7);
}

function labelFor(noteKey: string, todayKey: string): string {
  const noteDay = dayIndexOf(noteKey);
  const todayDay = dayIndexOf(todayKey);
  const distance = todayDay - noteDay;

  if (distance <= 0) return "오늘";
  if (distance === 1) return "어제";

  const noteWeek = weekStartOf(noteDay);
  const todayWeek = weekStartOf(todayDay);
  if (noteWeek === todayWeek) return "이번 주";
  if (noteWeek === todayWeek - 7) return "지난주";

  const [noteYear, noteMonth] = noteKey.split("-");
  const [todayYear, todayMonth] = todayKey.split("-");
  if (noteYear === todayYear && noteMonth === todayMonth) return "이번 달";

  return `${noteYear}년 ${Number(noteMonth)}월`;
}

/**
 * 이미 정렬된 노트를 날짜 라벨로 묶는다. **정렬을 여기서 하지 않는다** — 순서의 주인은
 * `sortNotesByRecency` 하나이고, 여기서 또 정렬하면 두 곳이 갈린다.
 */
export function groupNotesByRecency<T extends { updatedAt: string }>(
  sortedNotes: T[],
  now: number | null
): NoteGroup<T>[] {
  if (!sortedNotes.length) return [];
  if (now === null) {
    return [{ key: "all", label: null, notes: sortedNotes }];
  }

  const todayKey = getAppDateKey(new Date(now));
  const groups: NoteGroup<T>[] = [];

  for (const note of sortedNotes) {
    const label = labelFor(getAppDateKey(note.updatedAt), todayKey);
    const last = groups.at(-1);

    if (last && last.label === label) {
      last.notes.push(note);
      continue;
    }
    groups.push({ key: label, label, notes: [note] });
  }

  return groups;
}
