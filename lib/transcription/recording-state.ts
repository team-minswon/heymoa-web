import type { StartTranscriptionSessionResponseData } from "@/lib/api/generated/models";
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

export type RecordingSession = StartTranscriptionSessionResponseData;

/** 녹음 하나의 화면 상태. 컨트롤러·타이머 같은 붙들고 있는 자원은 여기 없다. */
export type RecordingState = {
  session: RecordingSession | null;
  activeNoteId: string | null;
  activeWorkspaceId: string | null;
  phase: RecordingPhase;
  elapsedMs: number;
  transcriptionDegraded: boolean;
  connectionNotice: ConnectionNotice | null;
  buffer: BufferState | null;
  microphone: MicrophoneState;
  error: string | null;
  /** 재개 창이 끝나 멈췄다는 문구가 서 있다. 그동안만 회의 종료를 따로 감시한다. */
  windowExhausted: boolean;
  /** 재개 창이 끝나 버린 소리. 그 뒤 회의가 끝나면 「N초를 올리지 못했어요」가 쓴다. */
  droppedMs: number;
};

export const initialRecordingState: RecordingState = {
  session: null,
  activeNoteId: null,
  activeWorkspaceId: null,
  phase: "idle",
  elapsedMs: 0,
  transcriptionDegraded: false,
  connectionNotice: null,
  buffer: null,
  microphone: "live",
  error: null,
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
  /** 녹음이 실패로 끝났다. 알림과 받아쓰기 멈춤 표시를 걷는다. */
  | { type: "failed"; message: string }
  /** 재개 창이 끝나 멈췄다. 이 탭이 버린 세션이라 열린 세션으로 들지 않는다. */
  | { type: "window-exhausted"; message: string; droppedMs: number }
  /** 시작하다 실패했다. 녹음이 시작되기 전이라 걷을 알림이 없다. */
  | { type: "start-failed"; message: string }
  | { type: "completed"; session: RecordingSession | null }
  | { type: "error"; message: string }
  /** 시작하는 사이 워크스페이스에서 쫓겨났다. 문구는 추방 안내가 따로 띄운다. */
  | { type: "evicted" }
  | { type: "disconnected" }
  | { type: "degraded"; shown: boolean }
  | { type: "notice"; notice: ConnectionNotice | null }
  | { type: "buffer"; buffer: BufferState }
  | { type: "microphone"; microphone: MicrophoneState }
  | { type: "tick"; ms: number };

export type RecordingFailure = Extract<
  RecordingAction,
  { type: "failed" | "window-exhausted" }
>;

/** 바뀐 값이 없으면 같은 객체를 돌려준다. 폴링이 같은 결론을 되풀이해도 다시 그리지 않는다. */
function patch(
  state: RecordingState,
  changes: Partial<RecordingState>
): RecordingState {
  const changed = (Object.keys(changes) as (keyof RecordingState)[]).some(
    (key) => !Object.is(state[key], changes[key])
  );
  return changed ? { ...state, ...changes } : state;
}

function failed(state: RecordingState, message: string): RecordingState {
  return patch(state, {
    phase: "failed",
    error: message,
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
      return failed(state, action.message);
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
        windowExhausted: false,
      });
    case "completed":
      return patch(state, {
        session: action.session ?? state.session,
        phase: "completed",
        transcriptionDegraded: false,
      });
    case "error":
      return patch(state, { error: action.message, windowExhausted: false });
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
    case "tick":
      return patch(state, { elapsedMs: state.elapsedMs + action.ms });
  }
}
