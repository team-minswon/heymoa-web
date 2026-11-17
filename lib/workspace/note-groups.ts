import { formatAppDate, getAppDateKey } from "@/lib/format/date";
import type { DatesT } from "@/lib/i18n/translator";
import { noteOrderedAt } from "@/lib/notes/meeting-state";

type NoteGroup<T> = {
  key: string;
  label: string;
  notes: T[];
};

/** 요일을 `Intl` 에 함께 넘기면 괄호 없이 `27일 월` 로 붙어서 따로 뽑습니다. */
function labelFor(iso: string, locale: string, t: DatesT): string {
  return t("noteGroup", {
    date: formatAppDate(
      iso,
      { year: "numeric", month: "long", day: "numeric" },
      locale
    ),
    weekday: formatAppDate(iso, { weekday: "short" }, locale),
  });
}

export function groupNotesByRecency<
  T extends { meetingStartedAt: string | null; createdAt: string },
>(sortedNotes: T[], locale: string, t: DatesT): NoteGroup<T>[] {
  const groups: NoteGroup<T>[] = [];

  for (const note of sortedNotes) {
    const orderedAt = noteOrderedAt(note);
    const key = getAppDateKey(orderedAt);
    const last = groups.at(-1);

    if (last && last.key === key) {
      last.notes.push(note);
      continue;
    }
    groups.push({ key, label: labelFor(orderedAt, locale, t), notes: [note] });
  }

  return groups;
}
