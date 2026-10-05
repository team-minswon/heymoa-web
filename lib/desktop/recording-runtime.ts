import type {
  DesktopBridge,
  DesktopCaptureBridge,
} from "@heymoa/desktop-contracts";
import { createDesktopAudioCapture } from "./capture";
import {
  BrowserRealtimeSession,
  type RealtimeSessionOptions,
} from "@/lib/transcription/realtime-session";

/** Browser sessions keep their existing microphone path; native sessions capture both inputs. */
export function createRecordingSession(options: RealtimeSessionOptions) {
  const bridge =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as { heymoaDesktop?: DesktopBridge }).heymoaDesktop;
  if (!bridge) return new BrowserRealtimeSession(options);
  return new BrowserRealtimeSession(options, {
    createAudio(onChunk, onLevel, onState) {
      if (
        [
          bridge.beginCapture,
          bridge.captureReady,
          bridge.endCapture,
          bridge.subscribeCapture,
        ].some((method) => typeof method !== "function")
      ) {
        return {
          sampleRate: 16000,
          requestPermission: async () => {
            throw new Error("DESKTOP_CAPTURE_UPDATE_REQUIRED");
          },
          start: async () => {
            throw new Error("DESKTOP_CAPTURE_UPDATE_REQUIRED");
          },
          stop: async () => {},
        };
      }
      const audio = createDesktopAudioCapture(
        {
          onChunk,
          onLevel,
          onState,
          onInputStates: ({ systemAudio }) =>
            options.onSystemAudioChange?.(systemAudio),
          onCaptureError: options.onCaptureError,
        },
        bridge as DesktopCaptureBridge
      );
      return {
        sampleRate: audio.sampleRate,
        async requestPermission() {
          // Both calls happen before the first await so preload can validate the click gesture.
          const capabilities = bridge.getCapabilities();
          const permission = audio.requestPermission();
          try {
            const [value] = await Promise.all([capabilities, permission]);
            if (
              !value.supported ||
              !value.capture ||
              value.captureContractVersion !== 1
            )
              throw new Error("DESKTOP_CAPTURE_UPDATE_REQUIRED");
          } catch (error) {
            await audio.stop().catch(() => undefined);
            throw error;
          }
        },
        start: () => audio.start(),
        stop: () => audio.stop(),
      };
    },
  });
}
