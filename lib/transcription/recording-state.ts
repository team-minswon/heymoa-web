import type { TranscriptionSessionResponseData } from "@/lib/api/generated/models";
import type { MicrophoneState } from "@/lib/transcription/audio";
import type {
  BufferState,
  ConnectionNotice,
} from "@/lib/transcription/realtime-session";

export type RecordingPhase =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "recording"
  | "stopping"
  | "completed"
  | "failed";

export const ACTIVE_PHASES: ReadonlySet<RecordingPhase> = new Set([
  "requesting-permission",
  "connecting",
  "recording",
  "stopping",
]);

export type RecordingSession = TranscriptionSessionResponseData;

export type RecordingState = {
  session: RecordingSession | null;
  activeNoteId: string | null;
  activeWorkspaceId: string | null;
  phase: RecordingPhase;
  transcriptionDegraded: boolean;
  connectionNotice: ConnectionNotice | null;
  buffer: BufferState | null;
  microphone: MicrophoneState;
  systemAudio: MicrophoneState | null;
  error: string | null;
  quotaExceeded: boolean;
  unconfirmedStop: boolean;
  windowExhausted: boolean;
  droppedMs: number;
};

export const initialRecordingState: RecordingState = {
  session: null,
  activeNoteId: null,
  activeWorkspaceId: null,
  phase: "idle",
  transcriptionDegraded: false,
  connectionNotice: null,
  buffer: null,
  microphone: "live",
  systemAudio: null,
  error: null,
  quotaExceeded: false,
  unconfirmedStop: false,
  windowExhausted: false,
  droppedMs: 0,
};

export type RecordingAction =
  | {
      type: "started";
      noteId: string;
      workspaceId: string;
      session: RecordingSession | null;
    }
  | { type: "phase"; phase: RecordingPhase }
  | { type: "session"; session: RecordingSession | null }
  | { type: "failed"; message: string; unconfirmedStop?: boolean }
  | { type: "window-exhausted"; message: string; droppedMs: number }
  | { type: "start-failed"; message: string; quotaExceeded?: boolean }
  | { type: "completed"; session: RecordingSession | null }
  | { type: "error"; message: string }
  | { type: "evicted" }
  | { type: "disconnected" }
  | { type: "degraded"; shown: boolean }
  | { type: "notice"; notice: ConnectionNotice | null }
  | { type: "buffer"; buffer: BufferState }
  | { type: "microphone"; microphone: MicrophoneState }
  | { type: "system-audio"; systemAudio: MicrophoneState | null };

export type RecordingFailure = Extract<
  RecordingAction,
  { type: "failed" | "window-exhausted" }
>;

function patch(
  state: RecordingState,
  changes: Partial<RecordingState>
): RecordingState {
  const changed = (Object.keys(changes) as (keyof RecordingState)[]).some(
    (key) => !Object.is(state[key], changes[key])
  );
  return changed ? { ...state, ...changes } : state;
}

function failed(
  state: RecordingState,
  message: string,
  unconfirmedStop = false
): RecordingState {
  return patch(state, {
    phase: "failed",
    error: message,
    quotaExceeded: false,
    unconfirmedStop,
    windowExhausted: false,
    connectionNotice: null,
    transcriptionDegraded: false,
  });
}

export function recordingReducer(
  state: RecordingState,
  action: RecordingAction
): RecordingState {
  switch (action.type) {
    case "started":
      return {
        ...initialRecordingState,
        activeNoteId: action.noteId,
        activeWorkspaceId: action.workspaceId,
        session: action.session,
        phase: "requesting-permission",
      };
    case "phase":
      return patch(state, { phase: action.phase });
    case "session":
      return patch(state, { session: action.session });
    case "failed":
      return failed(state, action.message, action.unconfirmedStop);
    case "window-exhausted":
      return patch(failed(state, action.message), {
        windowExhausted: true,
        droppedMs: action.droppedMs,
        session: state.session && { ...state.session, status: "INTERRUPTED" },
      });
    case "start-failed":
      return patch(state, {
        phase: "failed",
        error: action.message,
        quotaExceeded: action.quotaExceeded ?? false,
        unconfirmedStop: false,
        windowExhausted: false,
      });
    case "completed":
      return patch(state, {
        session: action.session ?? state.session,
        phase: "completed",
        transcriptionDegraded: false,
        error: state.unconfirmedStop ? null : state.error,
        unconfirmedStop: false,
      });
    case "error":
      return patch(state, {
        error: action.message,
        quotaExceeded: false,
        unconfirmedStop: false,
        windowExhausted: false,
      });
    case "evicted":
      return patch(state, {
        phase: "idle",
        activeNoteId: null,
        activeWorkspaceId: null,
      });
    case "disconnected":
      return initialRecordingState;
    case "degraded":
      return patch(state, { transcriptionDegraded: action.shown });
    case "notice":
      return patch(state, { connectionNotice: action.notice });
    case "buffer":
      return patch(state, { buffer: action.buffer });
    case "microphone":
      return patch(state, { microphone: action.microphone });
    case "system-audio":
      return patch(state, { systemAudio: action.systemAudio });
  }
}
