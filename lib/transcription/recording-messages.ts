import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import type { TranscriptionSessionResponseDataEndReason } from "@/lib/api/generated/models";
import type { RealtimeFailureKind } from "@/lib/transcription/realtime-session";

const START_FAILED = "녹음을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";
const DROPPED = "연결이 끊겨 녹음을 멈췄어요.";

export const SUPERSEDED_MESSAGE =
  "다른 탭이나 기기에서 이 녹음을 이어받았습니다.";
export const STOP_FAILED_MESSAGE = "녹음을 종료하는 중 오류가 발생했습니다.";
export const STOP_UNCONFIRMED_MESSAGE = "녹음 종료 상태를 확인하지 못했습니다.";

const lostAudio = (droppedMs: number) =>
  `이 기기에 남은 소리 ${Math.max(1, Math.round(droppedMs / 1_000))}초를 올리지 못했어요.`;

export function startErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  const name = cause instanceof Error ? cause.name : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "마이크 권한이 필요합니다. 브라우저 설정에서 마이크 사용을 허용해 주세요.";
  }
  if (name === "NotFoundError") {
    return "사용할 수 있는 마이크를 찾지 못했습니다.";
  }
  if (
    message === "WEBSOCKET_CLOSED" ||
    message === "WEBSOCKET_CONNECTION_FAILED" ||
    message === "STOMP_APPLICATION_READY_TIMEOUT"
  ) {
    return "실시간 스크립트 서버에 연결하지 못했습니다. 로그인 상태와 서버 연결을 확인해 주세요.";
  }
  if (errorCodeOf(cause) === "ACTIVE_TRANSCRIPTION_SESSION") {
    return "다른 탭이나 기기에서 이 회의를 녹음하고 있어요.";
  }
  // 녹음자 기기의 리스가 식어 server 가 세션을 정리(60초)하기를 기다리는 중이다. 기다리면 된다고 말한다
  if (errorCodeOf(cause) === "RECORDER_DISCONNECTED") {
    return "녹음하던 기기와 연결이 끊겼어요. 그 기기의 녹음이 정리되면(약 1분) 녹음할 수 있어요.";
  }
  if (message === "SESSION_CREATE_FAILED") {
    return "스크립트 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  // 봉투면 서버 문구를 쓴다. 전역 mutation 토스트를 꺼서 이 문구가 유일한 안내이고, web 이 코드별
  // 문구를 다시 만들면 서버와 갈라진다(rule `error-loading`).
  if (errorCodeOf(cause) !== null) return errorMessageOf(cause, START_FAILED);
  return START_FAILED;
}

export function runtimeFailureMessage(
  kind: RealtimeFailureKind,
  droppedMs: number
) {
  switch (kind) {
    case "resume_window_exhausted":
      return droppedMs > 0 ? `${DROPPED} ${lostAudio(droppedMs)}` : DROPPED;
    case "stop_timeout":
    case "stop_send_failed":
      return droppedMs > 0
        ? `마지막 기록을 정리하지 못해 ${lostAudio(droppedMs)}`
        : "마지막 기록을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    case "server_error":
      return "실시간 스크립트 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요.";
  }
}

/**
 * 회의 종료·일시중지는 오류로 말하지 않는다. 멤버 누구나 회의를 끝낼 수 있어서, 녹음하던
 * 사람에게는 정상 종료가 자주 일어난다.
 */
export function interruptedMessage(
  endReason: TranscriptionSessionResponseDataEndReason
) {
  switch (endReason) {
    case "MEETING_ENDED":
      return "회의가 종료되어 기록을 마쳤습니다.";
    case "MEETING_PAUSED":
      return "회의가 일시중지되어 기록을 멈췄습니다.";
    case "STT_PROVIDER_ERROR":
      return "음성 인식 서비스 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요.";
    case "CLIENT_DISCONNECTED":
      return "실시간 연결이 종료되어 녹음을 중단했습니다.";
    case "READY_TIMEOUT":
      return "녹음을 시작하지 못해 세션이 만료되었습니다. 다시 시도해 주세요.";
    case "HEARTBEAT_TIMEOUT":
      return "연결이 끊긴 채로 오래 있어 기록을 중단했습니다.";
    case "CLIENT_PROTOCOL_ERROR":
    case "INTERNAL_ERROR":
    case null:
      return "서버에서 스크립트 세션이 중단되었습니다.";
  }
}

/** 끊긴 사이 회의가 끝나면 이 기기에 남은 소리는 올릴 세션이 없다. */
export function meetingEndedMessage(pendingMs: number) {
  return pendingMs > 0
    ? `회의가 끝나 ${lostAudio(pendingMs)}`
    : interruptedMessage("MEETING_ENDED");
}
