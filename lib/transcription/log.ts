/**
 * 녹음 흐름의 콘솔 줄. web 은 로그 수집 창구가 없어 lab·docker Playwright 가 이 줄을 모은다(D-17).
 * 조각 단위로는 남기지 않는다.
 */
export type TranscriptionLogEvent =
  | "phase"
  | "notice"
  | "reconnect"
  | "live"
  | "ack"
  | "stop"
  | "offline"
  | "online";

export function logTranscription(
  event: TranscriptionLogEvent,
  fields: Record<string, unknown> = {}
) {
  console.info("[transcription]", event, fields);
}
