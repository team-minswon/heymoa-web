import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models/noteListResponseDataNotesItem";
import type { NoteResponseData } from "@/lib/api/generated/models/noteResponseData";
import type { NoteResponseDataMeetingStatus } from "@/lib/api/generated/models/noteResponseDataMeetingStatus";
import type { TranscriptResponseData } from "@/lib/api/generated/models/transcriptResponseData";
import { getAppDateKey } from "@/lib/format/date";

export const MEETING_STATUS_KEY = {
  NOT_STARTED: "notStarted",
  IN_PROGRESS: "inProgress",
  PAUSED: "paused",
  ENDED: "ended",
} as const satisfies Record<NoteResponseDataMeetingStatus, string>;

export type MeetingPhase =
  | "active"
  | "not-started"
  | "paused"
  | "ended"
  | "unknown";

type MeetingFields = Pick<NoteResponseData, "meetingStatus">;

export function deriveMeetingPhase(
  note: MeetingFields | undefined
): MeetingPhase {
  if (!note) return "unknown";
  if (note.meetingStatus === "NOT_STARTED") return "not-started";
  if (note.meetingStatus === "PAUSED") return "paused";
  if (note.meetingStatus === "ENDED") return "ended";
  return "active";
}

export function pausedDayCount(
  pausedAt: string | null | undefined,
  now: number | null
): number | null {
  if (!pausedAt || now === null) return null;
  const paused = Date.parse(pausedAt);
  if (!Number.isFinite(paused)) return null;
  const days = Math.round(
    (Date.parse(getAppDateKey(new Date(now))) -
      Date.parse(getAppDateKey(new Date(paused)))) /
      86_400_000
  );
  return days >= 1 ? days + 1 : null;
}

export function isMeetingActive(note: MeetingFields | undefined): boolean {
  return deriveMeetingPhase(note) === "active";
}

type MeetingTimingFields =
  | Pick<
      NoteResponseData,
      "meetingStatus" | "recordedDurationMs" | "activeSessionStartedAt"
    >
  | Pick<
      NoteListResponseDataNotesItem,
      "meetingStatus" | "recordedDurationMs" | "activeSessionStartedAt"
    >;

const recordedOf = (note: MeetingTimingFields) =>
  Number.isFinite(note.recordedDurationMs)
    ? Math.max(0, note.recordedDurationMs)
    : 0;

export function recordingClockOriginMs(
  note: MeetingTimingFields
): number | null {
  if (note.meetingStatus !== "IN_PROGRESS" || !note.activeSessionStartedAt)
    return null;
  const startedAt = Date.parse(note.activeSessionStartedAt);
  return Number.isFinite(startedAt) ? startedAt - recordedOf(note) : null;
}

export function getRecordedDurationMs(
  note: MeetingTimingFields,
  now: number
): number {
  if (note.meetingStatus === "NOT_STARTED") return 0;
  const recorded = recordedOf(note);
  const origin = recordingClockOriginMs(note);
  return origin !== null && Number.isFinite(now)
    ? Math.max(recorded, now - origin)
    : recorded;
}

type AxisTranscript = Pick<
  TranscriptResponseData,
  "segments" | "gaps" | "transcriptGaps"
>;

export function meetingLengthOf(
  axisEndMs: number | null | undefined,
  transcript: Partial<AxisTranscript> | null | undefined
): number {
  const ends = [
    ...(transcript?.segments ?? []),
    ...(transcript?.gaps ?? []),
    ...(transcript?.transcriptGaps ?? []),
  ].map((span) => span.endedAtMs);
  return Math.max(
    Number.isFinite(axisEndMs) ? Math.max(0, axisEndMs!) : 0,
    ...ends
  );
}

type NoteOrderFields = Pick<
  NoteListResponseDataNotesItem,
  "meetingStartedAt" | "createdAt"
>;

export function noteOrderedAt(note: NoteOrderFields): string {
  return note.meetingStartedAt ?? note.createdAt;
}

export function isPersonalChatHiddenInNote(view: "side" | "full"): boolean {
  return view === "side" || view === "full";
}
