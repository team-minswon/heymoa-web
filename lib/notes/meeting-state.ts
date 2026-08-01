import type { NoteSummary } from "@/lib/api/generated/models/noteSummary";
import type { NoteResponseData } from "@/lib/api/generated/models/noteResponseData";
import type { NoteSummaryMeetingStatus } from "@/lib/api/generated/models/noteSummaryMeetingStatus";

export const MEETING_STATUS_LABEL = {
  NOT_STARTED: "시작 전",
  IN_PROGRESS: "기록 중",
  PAUSED: "중지됨",
  ENDED: "종료됨",
} as const satisfies Record<NoteSummaryMeetingStatus, string>;

export const MEETING_PRIMARY_ACTION_LABEL = {
  NOT_STARTED: "회의 시작",
  IN_PROGRESS: "중지",
  PAUSED: "재개",
  ENDED: "요약 보기",
} as const satisfies Record<NoteSummaryMeetingStatus, string>;

/**
 * 공유 챗봇 컴포저가 갈리는 회의 상태. `unknown`은 노트를 아직 못 읽은 것 —
 * 게이트를 열지도 닫지도 않는다.
 */
export type SharedChatPhase =
  | "active"
  | "not-started"
  | "paused"
  | "ended"
  | "unknown";

type MeetingFields = Pick<NoteResponseData, "meetingStatus">;

/**
 * 노트의 회의 상태를 컴포저 상태로 접는다. 순수 함수 — 브라우저 없이 테스트한다.
 */
export function deriveMeetingPhase(
  note: MeetingFields | undefined
): SharedChatPhase {
  if (!note) return "unknown";
  if (note.meetingStatus === "NOT_STARTED") return "not-started";
  if (note.meetingStatus === "PAUSED") return "paused";
  if (note.meetingStatus === "ENDED") return "ended";
  return "active";
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
      NoteSummary,
      "meetingStatus" | "recordedDurationMs" | "activeSessionStartedAt"
    >;

export function getRecordedDurationMs(
  note: MeetingTimingFields,
  now: number
): number {
  if (note.meetingStatus === "NOT_STARTED") return 0;
  const recorded = Number.isFinite(note.recordedDurationMs)
    ? Math.max(0, note.recordedDurationMs)
    : 0;
  const activeStartedAt = note.activeSessionStartedAt
    ? Date.parse(note.activeSessionStartedAt)
    : Number.NaN;
  const live =
    note.meetingStatus === "IN_PROGRESS" &&
    Number.isFinite(activeStartedAt) &&
    Number.isFinite(now)
      ? Math.max(0, now - activeStartedAt)
      : 0;
  return recorded + live;
}

/**
 * 노트 화면에서 개인 챗봇을 감출까. side면 항상 감춘다. full에서는 공유 챗봇 트레이가 레일을
 * 독차지하는 동안(활성·미시작·중지)만 감춘다. 종료에는 개인 챗봇을 남긴다.
 *
 * `unknown`은 로딩과 실패 둘 다다. **로딩 중에만** 감춘다(트레이가 곧 뜬다). 조회가 실패하면
 * 트레이도 안 서므로, 여기서 감추면 챗 입구가 전무해진다 — 실패면 개인 챗봇을 남긴다.
 */
export function isPersonalChatHiddenInNote(
  view: "side" | "full",
  phase: SharedChatPhase,
  noteIsPending: boolean
): boolean {
  if (view === "side") return true;
  return (
    phase === "active" ||
    phase === "not-started" ||
    phase === "paused" ||
    (phase === "unknown" && noteIsPending)
  );
}

/** 회의 상태 폴링 주기. 다른 멤버가 녹음을 시작하거나 회의를 종료해도 화면이 따라가야 한다. */
export const MEETING_POLL_MS = 5_000;

/**
 * 노트 상태를 계속 폴링해야 하는가. 종료된 회의는 더 바뀌지 않으므로 멈춘다 —
 * 안 그러면 관전자가 종료 후에도 활성 컴포저를 보고 계속 `MEETING_NOT_ACTIVE`를 받는다.
 */
export function meetingRefetchInterval(
  note: MeetingFields | undefined
): number | false {
  return deriveMeetingPhase(note) === "ended" ? false : MEETING_POLL_MS;
}
