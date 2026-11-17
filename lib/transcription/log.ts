export type TranscriptionLogEvent =
  | "phase"
  | "notice"
  | "reconnect"
  | "live"
  | "ack"
  | "stop"
  | "offline"
  | "online"
  | "takeover"
  | "capture_error";

export function logTranscription(
  event: TranscriptionLogEvent,
  fields: Record<string, unknown> = {}
) {
  console.info("[transcription]", event, fields);
}
