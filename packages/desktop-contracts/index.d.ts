/** Native bridge declarations only. Runtime validation stays at each trust boundary. */
export type AudioInputState = "live" | "muted" | "ended" | "suspended";

export type RecordingSummary = {
  phase:
    | "idle"
    | "requesting-permission"
    | "connecting"
    | "recording"
    | "stopping"
    | "completed"
    | "failed";
  startedAt: number | null;
  pendingMs: number;
  microphone: AudioInputState | null;
  systemAudio: AudioInputState | null;
};

export type DesktopCapabilities = {
  bridgeVersion: number;
  platform: string;
  architecture: string;
  supported: boolean;
  capture: boolean;
  captureContractVersion?: number;
  login?: boolean;
  connectionOAuth?: boolean;
};

export type DesktopAuthOutcome = {
  status: "success" | "cancelled" | "error";
  reason?: "timeout" | "unavailable" | "authentication_failed" | "busy";
};
export type DesktopConnectionProvider = "LINEAR" | "GITHUB";
export type DesktopConnection = {
  workspaceId: string;
  provider: DesktopConnectionProvider;
};

export type DesktopCapturePacket =
  | {
      kind: "pcm";
      id: string;
      sequence: number;
      captureSamples: number;
      samples: ArrayBuffer;
    }
  | { kind: "levels"; id: string; microphone: number; systemAudio: number }
  | {
      kind: "states";
      id: string;
      microphone: AudioInputState;
      systemAudio: AudioInputState;
    }
  | { kind: "error"; id: string; code: string };

export type DesktopFoundationBridge = {
  getCapabilities(): Promise<DesktopCapabilities>;
  reportRecording(summary: RecordingSummary): Promise<void>;
  subscribeRecordingActions?: (
    listener: (action: DesktopRecordingAction) => void
  ) => () => void;
};
export type DesktopRecordingAction = "show-current" | "stop";
/** Optional methods let deployed web code inspect older installed applications. */
export type DesktopAuthBridge = {
  beginLogin?: () => Promise<DesktopAuthOutcome>;
  beginConnection?: (request: DesktopConnection) => Promise<DesktopAuthOutcome>;
  cancelAuth?: () => Promise<void>;
};
export type DesktopCaptureBridge = {
  getCapabilities(): Promise<DesktopCapabilities>;
  beginCapture(): Promise<string>;
  captureReady(id: string): Promise<void>;
  endCapture(id?: string): Promise<void>;
  subscribeCapture(
    listener: (packet: DesktopCapturePacket) => void
  ): () => void;
};
export type DesktopBridge = DesktopFoundationBridge &
  DesktopAuthBridge &
  Partial<DesktopCaptureBridge>;
