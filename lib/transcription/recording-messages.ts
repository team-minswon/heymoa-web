import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import type { TranscriptionSessionResponseDataEndReason } from "@/lib/api/generated/models";
import type { RealtimeFailureKind } from "@/lib/transcription/realtime-session";
import type { useTranslations } from "next-intl";

export type RecordingErrorsT = ReturnType<
  typeof useTranslations<"recording.errors">
>;

const lostSeconds = (ms: number) => Math.max(1, Math.round(ms / 1_000));

export const isQuotaExceeded = (cause: unknown) =>
  errorCodeOf(cause) === "RECORDING_QUOTA_EXCEEDED";

export function startErrorMessage(t: RecordingErrorsT, cause: unknown) {
  const error =
    cause instanceof Error || cause instanceof DOMException ? cause : null;
  const message = error?.message ?? "";
  const name = error?.name ?? "";
  // Electron IPC 오류는 "Error invoking remote method '…': Error: CODE" 로 감쌉니다.
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
  if (isQuotaExceeded(cause)) {
    return t("quotaExceeded");
  }
  if (errorCodeOf(cause) === "ACTIVE_TRANSCRIPTION_SESSION") {
    return t("activeSession");
  }
  if (errorCodeOf(cause) === "RECORDER_DISCONNECTED") {
    return t("recorderDisconnected");
  }
  if (message === "SESSION_CREATE_FAILED") {
    return t("sessionCreateFailed");
  }
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

export function meetingEndedMessage(t: RecordingErrorsT, pendingMs: number) {
  return pendingMs > 0
    ? t("meetingEndedLost", { seconds: lostSeconds(pendingMs) })
    : interruptedMessage(t, "MEETING_ENDED");
}
