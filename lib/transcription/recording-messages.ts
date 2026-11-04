import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import type { TranscriptionSessionResponseDataEndReason } from "@/lib/api/generated/models";
import type { RealtimeFailureKind } from "@/lib/transcription/realtime-session";
import type { useTranslations } from "next-intl";

/**
 * 녹음 실패 문구(`recording.errors`). 부르는 곳이 `RecordingProvider` 하나라 그 `useTranslations` 를 받는다.
 * 문구는 화면 상태(`RecordingState.error`)로 들어가 토스트가 그린다. 문구로 상태를 가르지 않는다 —
 * 「종료 확인 실패」는 액션의 `unconfirmedStop` 이 표시한다.
 */
export type RecordingErrorsT = ReturnType<
  typeof useTranslations<"recording.errors">
>;

const lostSeconds = (ms: number) => Math.max(1, Math.round(ms / 1_000));

export function startErrorMessage(t: RecordingErrorsT, cause: unknown) {
  const error =
    cause instanceof Error || cause instanceof DOMException ? cause : null;
  const message = error?.message ?? "";
  const name = error?.name ?? "";
  // Electron IPC 오류는 "Error invoking remote method '…': Error: CODE"로 감쌉니다.
  const captureCode = /(?:^|: )([A-Z][A-Z_]+)$/.exec(message)?.[1];

  if (captureCode === "AUDIO_PERMISSION_DENIED") {
    return t("audioPermission");
  }
  if (captureCode === "SYSTEM_AUDIO_INPUT_MISSING") {
    return t("systemAudioMissing");
  }
  if (captureCode === "AUDIO_CAPTURE_FAILED") {
    return t("audioCaptureFailed");
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return t("microphonePermission");
  }
  if (name === "NotFoundError" || captureCode === "MICROPHONE_INPUT_MISSING") {
    return t("microphoneMissing");
  }
  if (
    message === "WEBSOCKET_CLOSED" ||
    message === "WEBSOCKET_CONNECTION_FAILED" ||
    message === "STOMP_APPLICATION_READY_TIMEOUT"
  ) {
    return t("socketFailed");
  }
  if (errorCodeOf(cause) === "ACTIVE_TRANSCRIPTION_SESSION") {
    return t("activeSession");
  }
  // 녹음자 기기의 리스가 식어 server 가 세션을 정리(60초)하기를 기다리는 중이다. 기다리면 된다고 말한다
  if (errorCodeOf(cause) === "RECORDER_DISCONNECTED") {
    return t("recorderDisconnected");
  }
  if (message === "SESSION_CREATE_FAILED") {
    return t("sessionCreateFailed");
  }
  // 봉투면 서버 문구를 쓴다. 전역 mutation 토스트를 꺼서 이 문구가 유일한 안내이고, web 이 코드별
  // 문구를 다시 만들면 서버와 갈라진다(rule `error-loading`).
  if (errorCodeOf(cause) !== null)
    return errorMessageOf(cause, t("startFailed"));
  return t("startFailed");
}

export function runtimeFailureMessage(
  t: RecordingErrorsT,
  kind: RealtimeFailureKind,
  droppedMs: number
) {
  const seconds = lostSeconds(droppedMs);
  switch (kind) {
    case "resume_window_exhausted":
      return droppedMs > 0 ? t("droppedLost", { seconds }) : t("dropped");
    case "stop_timeout":
    case "stop_send_failed":
      return droppedMs > 0
        ? t("stopTimeoutLost", { seconds })
        : t("stopTimeout");
    case "server_error":
      return t("serverError");
  }
}

/**
 * 회의 종료·일시정지는 오류로 말하지 않는다. 멤버 누구나 회의를 끝낼 수 있어서, 녹음하던
 * 사람에게는 정상 종료가 자주 일어난다.
 */
export function interruptedMessage(
  t: RecordingErrorsT,
  endReason: TranscriptionSessionResponseDataEndReason
) {
  switch (endReason) {
    case "MEETING_ENDED":
    case "MEETING_PAUSED":
    case "STT_PROVIDER_ERROR":
    case "CLIENT_DISCONNECTED":
    case "READY_TIMEOUT":
    case "HEARTBEAT_TIMEOUT":
      return t(`interrupted.${endReason}`);
    case "CLIENT_PROTOCOL_ERROR":
    case "INTERNAL_ERROR":
    case null:
      return t("interrupted.other");
  }
}

/** 끊긴 사이 회의가 끝나면 이 기기에 남은 소리는 올릴 세션이 없다. */
export function meetingEndedMessage(t: RecordingErrorsT, pendingMs: number) {
  return pendingMs > 0
    ? t("meetingEndedLost", { seconds: lostSeconds(pendingMs) })
    : interruptedMessage(t, "MEETING_ENDED");
}
