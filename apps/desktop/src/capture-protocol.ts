import type { DesktopCapturePacket as CapturePacket } from "@heymoa/desktop-contracts";
export type {
  AudioInputState as InputState,
  DesktopCapturePacket as CapturePacket,
} from "@heymoa/desktop-contracts";
export const CAPTURE_EVENT = "heymoa:capture-event";
export const CAPTURE_PACKET = "heymoa:local-capture-packet";
export const CAPTURE_ACK = "heymoa:capture-ack";
export const LOCAL_ACK = "heymoa:local-capture-ack";
// 16 kHz mono PCM16, at most 100 ms per packet.
export const PCM_SAMPLES_PER_MS = 16;
export const PCM_MAX_BYTES = 3200;
// One in flight and one local queued packet permit at most 200 ms of delivery burst.
export const PCM_DELIVERY_BURST_SAMPLES = PCM_MAX_BYTES;
export const INPUT_STATUS_INTERVAL_MS = 50;
export const CAPTURE_ACK_TIMEOUT_MS = 2000;
const states = new Set(["live", "muted", "ended", "suspended"]);
export const CAPTURE_ERRORS = new Set([
  "AUDIO_CAPTURE_FAILED",
  "AUDIO_PERMISSION_DENIED",
  "SYSTEM_AUDIO_INPUT_MISSING",
  "MICROPHONE_INPUT_MISSING",
  "AUDIO_CAPTURE_CANCELLED",
  "UNSUPPORTED_CAPTURE_SAMPLE_RATE",
  "DESKTOP_AUDIO_BACKPRESSURE",
]);
export function capturePacket(value: unknown, id: string): CapturePacket {
  if (!value || typeof value !== "object")
    throw new Error("INVALID_CAPTURE_PACKET");
  const packet = value as Record<string, unknown>;
  if (packet.id !== id) throw new Error("INVALID_CAPTURE_PACKET");
  const keys = Object.keys(packet).sort().join(",");
  if (
    packet.kind === "pcm" &&
    keys === "captureSamples,id,kind,samples,sequence" &&
    Number.isSafeInteger(packet.sequence) &&
    (packet.sequence as number) >= 0 &&
    Number.isSafeInteger(packet.captureSamples) &&
    (packet.captureSamples as number) >= 0 &&
    packet.samples instanceof ArrayBuffer &&
    packet.samples.byteLength > 0 &&
    packet.samples.byteLength <= PCM_MAX_BYTES &&
    packet.samples.byteLength % 2 === 0
  )
    return value as CapturePacket;
  if (
    packet.kind === "levels" &&
    keys === "id,kind,microphone,systemAudio" &&
    [packet.microphone, packet.systemAudio].every(
      (number) =>
        typeof number === "number" &&
        Number.isFinite(number) &&
        number >= 0 &&
        number <= 1
    )
  )
    return value as CapturePacket;
  if (
    packet.kind === "states" &&
    keys === "id,kind,microphone,systemAudio" &&
    states.has(packet.microphone as string) &&
    states.has(packet.systemAudio as string)
  )
    return value as CapturePacket;
  if (
    packet.kind === "error" &&
    keys === "code,id,kind" &&
    CAPTURE_ERRORS.has(packet.code as string)
  )
    return value as CapturePacket;
  throw new Error("INVALID_CAPTURE_PACKET");
}
