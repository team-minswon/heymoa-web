import { acquireLocalInputs } from "../../../lib/desktop/local-inputs";
import { PcmAudioCapture } from "../../../lib/transcription/audio";
import { CAPTURE_ERRORS, type CapturePacket } from "../src/capture-protocol";
declare global {
  interface Window {
    heymoaCaptureLocal: {
      emit(packet: CapturePacket): void;
      onAck(listener: (sequence: number) => void): void;
    };
    captureLocalAcquire(id: string): Promise<void>;
    captureLocalStart(): Promise<void>;
    captureLocalStop(): Promise<void>;
  }
}
let capture: PcmAudioCapture | null = null;
let currentId = "",
  sequence = 0,
  pending: number | null = null;
let queued: { samples: ArrayBuffer; captureSamples: number } | null = null;
let drain: (() => void) | null = null;
function sendPcm(samples: ArrayBuffer, captureSamples: number) {
  pending = sequence;
  window.heymoaCaptureLocal.emit({
    kind: "pcm",
    id: currentId,
    sequence: sequence++,
    samples,
    captureSamples,
  });
}
window.heymoaCaptureLocal.onAck((value) => {
  if (pending !== value) return;
  pending = null;
  if (queued) {
    const frame = queued;
    queued = null;
    sendPcm(frame.samples, frame.captureSamples);
  } else {
    drain?.();
    drain = null;
  }
});
window.captureLocalAcquire = async (id) => {
  if (capture) throw new Error("CAPTURE_ALREADY_REQUESTED");
  currentId = id;
  const emit = (packet: CapturePacket) =>
    window.heymoaCaptureLocal.emit(packet);
  capture = new PcmAudioCapture({
    workletUrl: "./pcm-capture-worklet.js",
    acquireInputs: acquireLocalInputs,
    onChunk: (samples, captureSamples) => {
      if (pending !== null) {
        if (!queued) {
          queued = { samples, captureSamples };
          return;
        }
        emit({
          kind: "error",
          id: currentId,
          code: "DESKTOP_AUDIO_BACKPRESSURE",
        });
        void capture?.stop();
        return;
      }
      sendPcm(samples, captureSamples);
    },
    onInputLevels: ({ microphone, systemAudio }) =>
      emit({
        kind: "levels",
        id: currentId,
        microphone,
        systemAudio: systemAudio ?? 0,
      }),
    onInputStates: ({ microphone, systemAudio }) =>
      emit({
        kind: "states",
        id: currentId,
        microphone,
        systemAudio: systemAudio ?? "ended",
      }),
  });
  try {
    await capture.requestPermission();
  } catch (error) {
    await capture.stop();
    capture = null;
    const code =
      error instanceof Error && error.name === "NotAllowedError"
        ? "AUDIO_PERMISSION_DENIED"
        : error instanceof Error && CAPTURE_ERRORS.has(error.message)
          ? error.message
          : "AUDIO_CAPTURE_FAILED";
    throw new Error(code);
  }
};
window.captureLocalStart = async () => {
  try {
    await capture?.start();
  } catch (error) {
    const code =
      error instanceof Error && CAPTURE_ERRORS.has(error.message)
        ? error.message
        : "AUDIO_CAPTURE_FAILED";
    window.heymoaCaptureLocal.emit({ kind: "error", id: currentId, code });
    throw new Error(code);
  }
};
window.captureLocalStop = async () => {
  await capture?.stop();
  if (pending !== null)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        drain = null;
        reject(new Error("DESKTOP_AUDIO_BACKPRESSURE"));
      }, 2000);
      drain = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
  capture = null;
};
