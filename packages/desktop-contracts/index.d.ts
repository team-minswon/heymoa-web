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
  /** Recording clock origin (epoch ms). The tray shows `now - startedAt`; it is not the session start. */
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
  meetingTimeline?: boolean;
  updates?: boolean;
};

/** Display-only, bounded snapshot. No cookies, URLs, HTML, PCM or API credentials. */
export type MeetingTimelineItem = {
  id: string;
  tone: "decision" | "task" | "open" | "answered" | "reference";
  label: string;
  content: string;
  atMs: number | null;
  citations: Array<{ atMs: number; text: string }>;
};
export type MeetingTimelineSnapshot = {
  noteId: string;
  title: string;
  loading: boolean;
  failed: boolean;
  reconnecting: boolean;
  total: number;
  items: MeetingTimelineItem[];
  /** v2 clients only; older clients reject unknown snapshot fields. */
  detail?: {
    workspaceId?: string;
    ownsRecording?: boolean;
    selectionId?: number;
    meetingState?: "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "ENDED";
    ended?: boolean;
    summary?: {
      status: "loading" | "pending" | "failed" | "ready" | "unavailable";
      lead: string;
      sections: Array<{
        id: string;
        title: string;
        description: string;
        conclusions: string[];
        openItems: string[];
      }>;
    };
    counts: Record<
      "ALL" | "DECISION" | "ACTION_ITEM" | "OPEN" | "REFERENCE",
      number
    >;
    groups: Array<{
      id: string;
      title: string;
      startMs: number | null;
      endMs: number | null;
      itemIds: string[];
    }>;
    partial: { confirmedText: string; pendingText: string } | null;
  };
};

/** Display-only list entry for a meeting in progress. Navigation uses ids only. */
export type ActiveMeeting = {
  state?: "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "ENDED";
  ended?: boolean;
  workspaceId: string;
  noteId: string;
  title: string;
  /** Recording clock origin (epoch ms), same meaning as `RecordingSummary.startedAt`. */
  startedAt: number | null;
};
export type MeetingTarget = {
  workspaceId: string;
  noteId: string;
  requestId?: number;
};
export type MeetingListSnapshot = {
  workspaceId: string | null;
  status: "loading" | "ready" | "failed" | "no-workspace";
  meetings: ActiveMeeting[];
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

export type DesktopUpdateState = {
  currentVersion: string;
  automatic: boolean;
  status:
    | "idle"
    | "checking"
    | "current"
    | "available"
    | "downloading"
    | "ready"
    | "installing"
    | "error"
    | "unavailable";
  version?: string;
  percent?: number;
  canRestart: boolean;
};
export type DesktopUpdateActivity =
  | {
      action: "check" | "restart";
      currentVersion: string;
      targetVersion?: string;
    }
  | { action: "automatic"; currentVersion: string; enabled: boolean }
  | { action: "opacity"; opacity: number };
export type DesktopUpdateBridge = {
  openPreferences?: () => Promise<void>;
  subscribeUpdateActivity?: (
    listener: (activity: DesktopUpdateActivity) => void
  ) => () => void;
  getUpdateState(): Promise<DesktopUpdateState>;
  checkForUpdates(): Promise<DesktopUpdateState>;
  setAutomaticUpdates(enabled: boolean): Promise<DesktopUpdateState>;
  restartForUpdate(): Promise<DesktopUpdateState>;
  subscribeUpdates(listener: (state: DesktopUpdateState) => void): () => void;
};

export type DesktopFoundationBridge = {
  meetingTimelineVersion?: number;
  openSitePage?: (href: string) => Promise<void>;
  reportLanguage?: (language: "ko" | "en") => Promise<void>;
  getCapabilities(): Promise<DesktopCapabilities>;
  reportRecording(summary: RecordingSummary): Promise<void>;
  reportMeetingTimeline?: (
    snapshot: MeetingTimelineSnapshot | null
  ) => Promise<void>;
  reportActiveMeetings?: (meetings: ActiveMeeting[]) => Promise<void>;
  reportMeetingList?: (snapshot: MeetingListSnapshot) => Promise<void>;
  reportRecordingTarget?: (
    target: Pick<MeetingTarget, "workspaceId" | "noteId"> | null
  ) => Promise<void>;
  getMeetingSelection?: () => Promise<MeetingTarget | null>;
  subscribeMeetingSelection?: (
    listener: (target: MeetingTarget | null) => void
  ) => () => void;
  reportMeetingUnavailable?: (
    noteId: string,
    requestId?: number,
    retryable?: boolean
  ) => Promise<void>;
  subscribeOpenNote?: (
    listener: (target: {
      workspaceId: string;
      noteId: string;
      tab?: "summary" | "transcript" | "context";
    }) => void
  ) => () => void;
  subscribeRecordingActions?: (
    listener: (action: DesktopRecordingAction) => void
  ) => () => void;
};
export type DesktopRecordingAction = "show-current" | "stop" | "stop-viewing";
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
  Partial<DesktopUpdateBridge> &
  Partial<DesktopCaptureBridge>;
