import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models/noteListResponseDataNotesItem";
import type { NoteResponseData } from "@/lib/api/generated/models/noteResponseData";
import type { NoteResponseDataMeetingStatus } from "@/lib/api/generated/models/noteResponseDataMeetingStatus";

export const MEETING_STATUS_LABEL = {
  NOT_STARTED: "시작 전",
  IN_PROGRESS: "기록 중",
  PAUSED: "중지됨",
  ENDED: "종료됨",
} as const satisfies Record<NoteResponseDataMeetingStatus, string>;

export const MEETING_PRIMARY_ACTION_LABEL = {
  NOT_STARTED: "회의 시작",
  IN_PROGRESS: "중지",
  PAUSED: "재개",
  ENDED: "요약 보기",
} as const satisfies Record<NoteResponseDataMeetingStatus, string>;

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
      NoteListResponseDataNotesItem,
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
/**
 * 노트 안에서는 **항상** 감춘다.
 *
 * - full: 오른쪽 440은 공유 레일이 상주하는 자리라(design.pen `L4PpR`) 개인 챗봇이 `fixed`로
 *   그 위에 뜨면 챗 UI 둘이 겹친다.
 * - side: 시트와 backdrop이 `z-50`이라 `z-30/40`인 개인 챗봇 패널·FAB는 그 아래 깔린다 —
 *   보여 봐야 누를 수 없다.
 *
 * **조회 실패도 예외로 두지 않는다.** 한때 실패면 개인 챗봇을 남기게 했는데, side에서는 위
 * 이유로 눌리지 않아 없는 구제책이었다. 실패의 정상 경로는 노트 자신의 `InlineRetry`다.
 */
export function isPersonalChatHiddenInNote(view: "side" | "full"): boolean {
  // 노트 안에서는 **떠 있는 카드로는** 항상 감춘다. `fixed`로 뜨면 오른쪽 440의 레일
  // (design.pen `L4PpR`) 위에 겹쳐 챗 UI가 둘이 된다.
  //
  // 전체 화면에서 개인 챗봇에 못 가는 것은 아니다 — 레일의 「내 에이전트」 탭이 셸의 그 패널을
  // 자기 자리로 포털해 온다(`note-agent-rail`). 이 값이 참이어야 스코프가 워크스페이스로
  // 남고, 그게 정본의 「나만 보는 대화 · 워크스페이스 범위」와 맞는다.
  return view === "side" || view === "full";
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
