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
 * 회의 상태를 화면이 쓰는 형태로 접은 값. 계약의 `meetingStatus` 넷에 **`unknown`**을 더한다 —
 * 노트를 아직 못 읽은 것이라 게이트를 열지도 닫지도 않는다. 지금은 전사 화면과 노트 패널이
 * 이 값으로 갈린다(탭 구성·레일 폭·폴링 지속).
 */
export type MeetingPhase =
  | "active"
  | "not-started"
  | "paused"
  | "ended"
  | "unknown";

type MeetingFields = Pick<NoteResponseData, "meetingStatus">;

/**
 * 노트의 회의 상태를 화면 상태로 접는다. 순수 함수 — 브라우저 없이 테스트한다.
 */
export function deriveMeetingPhase(
  note: MeetingFields | undefined
): MeetingPhase {
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

type NoteOrderFields = Pick<
  NoteListResponseDataNotesItem,
  "meetingStartedAt" | "createdAt"
>;

/**
 * 노트 목록에서 노트가 서는 시각. **회의를 기록하기 시작한 시각**이고, 한 번도 기록하지
 * 않았으면 만든 시각이다. 서버의 정렬 기준과 같은 식이다(`openapi3.yml`의 노트 목록 설명).
 *
 * **`updatedAt`이 아니다.** 제목만 고쳐도 `updatedAt`이 바뀌어서, 지난주 회의가 오늘 회의보다
 * 위에 서고 오늘 날짜 묶음으로 옮겨갔다. 회의 목록은 "무엇을 마지막으로 만졌나"가 아니라
 * "언제 열렸나"로 찾는 기록이다.
 *
 * **정렬과 날짜 묶음이 같은 값을 써야 한다.** `groupNotesByRecency`는 입력이 이미 그 키로
 * 정렬됐다고 전제하므로, 둘이 갈리면 같은 날짜 묶음이 목록에 여러 번 생긴다.
 */
export function noteOrderedAt(note: NoteOrderFields): string {
  return note.meetingStartedAt ?? note.createdAt;
}

/**
 * 노트 화면에서 **떠 있는 카드로는** 개인 챗봇을 감출까. 노트 안에서는 **항상** 감춘다.
 *
 * - full: 오른쪽 440은 에이전트 레일이 상주하는 자리라(design.pen `L4PpR`) 개인 챗봇이 `fixed`로
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
  // 전체 화면에서 개인 챗봇에 못 가는 것은 아니다 — 레일이 셸의 그 패널을 자기 자리로
  // 포털해 온다(`note-agent-rail`). 이 값이 참이어야 스코프가 워크스페이스로 남고, 그게
  // 정본의 「나만 보는 대화 · 워크스페이스 범위」와 맞는다.
  return view === "side" || view === "full";
}

/** 회의 상태 폴링 주기. 다른 멤버가 녹음을 시작하거나 회의를 종료해도 화면이 따라가야 한다. */
export const MEETING_POLL_MS = 5_000;

/**
 * 노트 상태를 계속 폴링해야 하는가. 종료된 회의는 더 바뀌지 않으므로 멈춘다 —
 * 안 그러면 끝난 노트를 열어 둔 사람마다 5초짜리 조회가 영원히 돈다.
 */
export function meetingRefetchInterval(
  note: MeetingFields | undefined
): number | false {
  return deriveMeetingPhase(note) === "ended" ? false : MEETING_POLL_MS;
}
