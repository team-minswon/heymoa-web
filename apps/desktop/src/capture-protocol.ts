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
// How long the remote window may stall before capture gives up. Long tasks and GC
// pauses run in the hundreds of ms; a window silent for 3 s is hung, not busy.
// 30 queued 100 ms chunks are about 96 KB.
export const CAPTURE_BACKLOG_MS = 3000;
export const CAPTURE_BACKLOG_SAMPLES = CAPTURE_BACKLOG_MS * PCM_SAMPLES_PER_MS;
export const INPUT_STATUS_INTERVAL_MS = 50;
export const CAPTURE_ACK_TIMEOUT_MS = CAPTURE_BACKLOG_MS;
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

type PcmPacket = Extract<CapturePacket, { kind: "pcm" }>;
// One packet in flight to the remote window; the rest wait here up to the backlog bound.
export class PcmSender {
  private sequence = 0;
  private pending: number | null = null;
  private readonly queue: { samples: ArrayBuffer; captureSamples: number }[] =
    [];
  private queuedSamples = 0;
  private drained: (() => void) | null = null;
  private progressed: (() => void) | null = null;
  constructor(
    private readonly id: string,
    private readonly emit: (packet: PcmPacket) => void
  ) {}
  /** false when the backlog bound would be exceeded. */
  push(samples: ArrayBuffer, captureSamples: number): boolean {
    if (this.pending === null) {
      this.send(samples, captureSamples);
      return true;
    }
    if (this.queuedSamples + samples.byteLength / 2 > CAPTURE_BACKLOG_SAMPLES)
      return false;
    this.queue.push({ samples, captureSamples });
    this.queuedSamples += samples.byteLength / 2;
    return true;
  }
  ack(sequence: number) {
    if (this.pending !== sequence) return;
    this.pending = null;
    this.progressed?.();
    const next = this.queue.shift();
    if (next) {
      this.queuedSamples -= next.samples.byteLength / 2;
      this.send(next.samples, next.captureSamples);
    } else {
      this.drained?.();
      this.drained = null;
    }
  }
  /** Fails only when no ACK arrives for the backlog bound, like the host's per-packet deadline. */
  drain(): Promise<void> {
    if (this.pending === null) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout>;
      const arm = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.drained = this.progressed = null;
          reject(new Error("DESKTOP_AUDIO_BACKPRESSURE"));
        }, CAPTURE_BACKLOG_MS);
      };
      arm();
      this.progressed = arm;
      this.drained = () => {
        clearTimeout(timeout);
        this.progressed = null;
        resolve();
      };
    });
  }
  private send(samples: ArrayBuffer, captureSamples: number) {
    this.pending = this.sequence;
    this.emit({
      kind: "pcm",
      id: this.id,
      sequence: this.sequence++,
      samples,
      captureSamples,
    });
  }
}
