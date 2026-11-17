import type {
  NoteResponseData,
  TranscriptResponseData,
} from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import type { DatesT } from "@/lib/i18n/translator";
import {
  getRecordedDurationMs,
  meetingLengthOf,
} from "@/lib/notes/meeting-state";

export function buildNoteHeaderMeta(
  note: NoteResponseData,
  {
    isStarter,
    transcript,
    locale,
    t,
  }: {
    isStarter: boolean;
    locale: string;
    t: DatesT;
    transcript?: TranscriptResponseData | null;
  }
): {
  participantLabel: string | null;
  whenIso: string;
  whenLabel: string;
  secondary: string;
} {
  const participantCount = note.participants?.length ?? 0;
  const whenIso = note.meetingStartedAt ?? note.createdAt;
  const head = {
    participantLabel:
      participantCount > 0
        ? t("noteMeta.participants", { count: participantCount })
        : null,
    whenIso,
    whenLabel: formatAppDate(
      whenIso,
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
      locale
    ),
  };

  if (note.meetingStatus === "NOT_STARTED") {
    return { ...head, secondary: t("noteMeta.notStarted") };
  }

  if (note.meetingStatus === "IN_PROGRESS") {
    const starter = note.meetingStartedBy;
    return {
      ...head,
      secondary: [
        !isStarter && starter
          ? t("noteMeta.recordingBy", { name: starter.name })
          : null,
        t("noteMeta.visibleToMembers"),
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  // 렌더 중에 `Date.now()` 를 읽으면 서버 HTML 과 첫 클라이언트 렌더가 갈려 하이드레이션이 어긋나 `now` 를 받지 않습니다.
  const minutes = Math.floor(
    meetingLengthOf(getRecordedDurationMs(note, 0), transcript) / 60_000
  );
  return {
    ...head,
    secondary: t("noteMeta.recorded", {
      hours: Math.floor(minutes / 60),
      minutes: minutes % 60,
    }),
  };
}
