import type { PcmAudioCaptureOptions } from "@/lib/transcription/audio";
import type { DesktopCaptureBridge } from "@heymoa/desktop-contracts";
export type {
  DesktopCapabilities,
  DesktopCapturePacket,
  DesktopCaptureBridge,
} from "@heymoa/desktop-contracts";
export interface DesktopAudioPort {
  readonly sampleRate: number;
  requestPermission(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
export function createDesktopAudioCapture(
  options: PcmAudioCaptureOptions & { onCaptureError?: (code: string) => void },
  bridge: DesktopCaptureBridge
): DesktopAudioPort {
  if (
    [
      bridge.beginCapture,
      bridge.captureReady,
      bridge.endCapture,
      bridge.subscribeCapture,
    ].some((method) => typeof method !== "function")
  )
    throw new Error("DESKTOP_CAPTURE_UPDATE_REQUIRED");
  let id: string | null = null,
    generation = 0;
  let permission: Promise<void> | null = null,
    starting: Promise<void> | null = null;
  let stopping: Promise<void> | null = null;
  let unsubscribe: (() => void) | null = null;
  let active = false;
  let draining = false;
  const port: DesktopAudioPort = {
    sampleRate: 16000,
    requestPermission() {
      if (stopping) return Promise.reject(new Error("CAPTURE_STOPPING"));
      if (id) return Promise.resolve();
      if (permission) return permission;
      const token = generation;
      const pending = bridge
        .beginCapture()
        .then(async (value) => {
          if (token !== generation) {
            await bridge.endCapture(value).catch(() => undefined);
            throw new Error("AUDIO_CAPTURE_CANCELLED");
          }
          id = value;
        })
        .finally(() => {
          if (permission === pending) permission = null;
        });
      permission = pending;
      return pending;
    },
    start() {
      if (starting) return starting;
      if (active) return Promise.resolve();
      const token = generation;
      const pending = (async () => {
        await port.requestPermission();
        if (token !== generation || !id)
          throw new Error("AUDIO_CAPTURE_CANCELLED");
        unsubscribe = bridge.subscribeCapture((packet) => {
          if (packet.id !== id || (token !== generation && !draining)) return;
          if (packet.kind === "pcm")
            options.onChunk(packet.samples, packet.captureSamples);
          else if (packet.kind === "levels") {
            options.onLevel?.(packet.microphone);
            options.onInputLevels?.({
              microphone: packet.microphone,
              systemAudio: packet.systemAudio,
            });
          } else if (packet.kind === "states") {
            options.onState?.(packet.microphone);
            options.onInputStates?.({
              microphone: packet.microphone,
              systemAudio: packet.systemAudio,
            });
          } else {
            options.onCaptureError?.(packet.code);
            options.onState?.("ended");
            options.onInputStates?.({
              microphone: "ended",
              systemAudio: "ended",
            });
            void port.stop().catch(() => undefined);
          }
        });
        await bridge.captureReady(id);
        if (token !== generation) throw new Error("AUDIO_CAPTURE_CANCELLED");
        active = true;
      })()
        .catch(async (error) => {
          if (token === generation) await port.stop().catch(() => undefined);
          throw error;
        })
        .finally(() => {
          if (starting === pending) starting = null;
        });
      starting = pending;
      return pending;
    },
    stop() {
      if (stopping) return stopping;
      generation++;
      active = false;
      const old = id;
      draining = Boolean(old);
      const wasPending = permission !== null;
      permission = null;
      starting = null;
      const pending = (async () => {
        try {
          if (old || wasPending) await bridge.endCapture(old ?? undefined);
        } catch (error) {
          options.onCaptureError?.("AUDIO_CAPTURE_FAILED");
          throw error;
        } finally {
          if (id === old) id = null;
          draining = false;
          unsubscribe?.();
          unsubscribe = null;
          options.onLevel?.(0);
          options.onInputLevels?.({ microphone: 0, systemAudio: 0 });
        }
      })().finally(() => {
        if (stopping === pending) stopping = null;
      });
      stopping = pending;
      return pending;
    },
  };
  return port;
}
