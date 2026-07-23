import type { NoteResponseDataMeetingStartedBy } from "@/lib/api/generated/models/noteResponseDataMeetingStartedBy";
import type { NoteResponseDataMeetingStatus } from "@/lib/api/generated/models/noteResponseDataMeetingStatus";

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

type MeetingFields = {
  meetingStatus: NoteResponseDataMeetingStatus;
  meetingStartedBy: NoteResponseDataMeetingStartedBy;
};

/**
 * 노트의 회의 상태를 컴포저 상태로 접는다. 순수 함수 — 브라우저 없이 테스트한다.
 *
 * **ACTIVE 판정 = IN_PROGRESS && meetingStartedBy !== null.** 새 노트는 생성 시부터
 * IN_PROGRESS라 시작자가 없으면 아직 회의가 열린 게 아니다(계약 단일 출처: APP-120).
 */
export function deriveMeetingPhase(
  note: MeetingFields | undefined
): SharedChatPhase {
  if (!note) return "unknown";
  if (note.meetingStatus === "ENDED") return "ended";
  if (note.meetingStatus === "PAUSED") return "paused";
  // IN_PROGRESS
  return note.meetingStartedBy ? "active" : "not-started";
}

export function isMeetingActive(note: MeetingFields | undefined): boolean {
  return deriveMeetingPhase(note) === "active";
}

/**
 * 노트 화면에서 개인 챗봇을 감출까. side면 항상 감춘다. full에서는 공유 챗봇 트레이가 레일을
 * 독차지하는 동안(활성·미시작)만 감춘다 — **중지·종료에는 개인 챗봇을 남긴다.**
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
    (phase === "unknown" && noteIsPending)
  );
}

/** 회의 상태 폴링 주기. 다른 멤버가 시작·중지·재개·종료해도 화면이 따라가야 한다. */
export const MEETING_POLL_MS = 5_000;

/**
 * 노트 상태를 계속 폴링해야 하는가. 종료된 회의는 더 바뀌지 않으므로 멈춘다 —
 * 안 그러면 관전자가 중지 후에도 활성 컴포저를 보고 계속 `MEETING_NOT_ACTIVE`를 받는다.
 */
export function meetingRefetchInterval(
  note: MeetingFields | undefined
): number | false {
  return deriveMeetingPhase(note) === "ended" ? false : MEETING_POLL_MS;
}
