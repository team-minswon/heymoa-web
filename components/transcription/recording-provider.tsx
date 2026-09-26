"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import type {
  StartTranscriptionSessionResponseData,
  TranscriptionSessionResponseDataEndReason,
} from "@/lib/api/generated/models";
import {
  getGetNoteTranscriptQueryKey,
  useGetTranscriptionSession,
  useStartTranscriptionSession,
} from "@/lib/api/generated/transcription/transcription";
import {
  getGetNoteQueryKey,
  useGetNote,
} from "@/lib/api/generated/notes/notes";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { isNoteListQueryKey } from "@/lib/notes/query-keys";
import { forgetWorkspace } from "@/lib/workspace/cache";
import { notifyWorkspaceGone } from "@/lib/workspace/gone-notice";
import type { MicrophoneState } from "@/lib/transcription/audio";
import { logTranscription } from "@/lib/transcription/log";
import {
  BrowserRealtimeSession,
  adoptDeadRecorder,
  beatRecording,
  clientInstanceId,
  expireRecording,
  forgetRecording,
  RECORDING_BEAT_MS,
  touchRecording,
  type BufferState,
  type ConnectionNotice,
  type RealtimeSessionController,
  type RealtimeSessionOptions,
} from "@/lib/transcription/realtime-session";
import {
  isTerminalError,
  type ServerEvent,
} from "@/lib/transcription/protocol";
import {
  initialTranscriptState,
  transcriptReducer,
  type TranscriptState,
} from "@/lib/transcription/transcript-reducer";

export type RecordingRuntime = {
  createSession: (options: RealtimeSessionOptions) => RealtimeSessionController;
};

export type LocalRecordingSession = StartTranscriptionSessionResponseData;

export type RecordingApi = {
  startSession: (
    noteId: string
  ) => Promise<StartTranscriptionSessionResponseData>;
};

export type RecordingPhase =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "recording"
  | "stopping"
  | "completed"
  | "failed";

export type RecordingContextValue = {
  session: LocalRecordingSession | null;
  activeNoteId: string | null;
  /**
   * 녹음 중인 노트가 **어느 워크스페이스의 것인가.**
   *
   * 계약이 안 알려준다 — 노트 응답에는 `projectId`만 있고 세션 응답에는 둘 다 없다. 그래서
   * `start()`가 호출부에서 받아 들고 있는다. 세션이 생기는 길은 `start()` 하나뿐이라
   * (제품 코드에 `useGetCurrentTranscriptionSession` 사용처가 없고, 세션 폴링은
   * `session?.sessionId`가 있어야 켜지며, reconcile은 이미 있는 세션만 갱신한다)
   * 녹음 중인데 이 값이 비어 있는 상태는 생기지 않는다.
   */
  activeWorkspaceId: string | null;
  phase: RecordingPhase;
  elapsedMs: number;
  /**
   * 소리는 쌓이는데 **글자만 멈춘** 상태인가 (APP-416).
   *
   * 서버만 아는 사실이다 — 받아쓰기 업체 소켓이 끊긴 것을 브라우저는 자막이 멈춘 것으로만
   * 본다. 회복하면 서버가 `LIVE` 를 보내 되돌린다.
   */
  transcriptionDegraded: boolean;
  /** 받아쓰기·실시간 분석이 멈췄다는 노랑 알림. 그동안 소리는 브라우저 메모리에 쌓인다. */
  connectionNotice: ConnectionNotice | null;
  /** 서버가 확정 안 한 소리가 이 기기에 얼마나 있고, 한도에 닿아 멈췄는지. 녹음 전이면 null. */
  buffer: BufferState | null;
  microphone: MicrophoneState;
  error: string | null;
  start: (noteId: string, workspaceId: string) => Promise<void>;
  stop: () => Promise<boolean>;
  disconnect: () => Promise<void>;
};

export type RecordingMeterValue = {
  level: number;
  levelHistory: number[];
};

const RecordingContext = createContext<RecordingContextValue | null>(null);
const RecordingTranscriptContext = createContext<TranscriptState | null>(null);
const RecordingMeterContext = createContext<RecordingMeterValue | null>(null);
const ACTIVE_PHASES = new Set<RecordingPhase>([
  "requesting-permission",
  "connecting",
  "recording",
  "stopping",
]);

/**
 * 지금 붙들고 있는 전사 세션이 아직 살아 있는가. **무엇의 녹음인지는 안 본다** — 노트로
 * 물을지 워크스페이스로 물을지는 아래 두 함수가 정한다.
 *
 * 살아 있으면 회의 중지·종료가 계약상 `ACTIVE_TRANSCRIPTION_SESSION`(409)로 막힌다.
 * **`failed`도 세션이 열려 있으면 활성이다**: stop이 실패하면 phase는 failed지만
 * READY/ACTIVE 세션은 그대로 남아 서버가 여전히 거절한다.
 */
function isRecordingLive(
  recording: Pick<RecordingContextValue, "session" | "phase">
): boolean {
  // 진행 phase는 세션 id가 붙기 전(권한 요청·연결 중)이라도 활성이다 — 그 사이 pause/end를
  // 열어 두면 뒤늦게 시작이 세션을 만들어 회의를 되살린다.
  if (ACTIVE_PHASES.has(recording.phase)) return true;
  // failed는 서버 세션이 아직 열려 있을 때만 활성(READY/ACTIVE).
  const sessionOpen =
    recording.session?.status === "READY" ||
    recording.session?.status === "ACTIVE";
  return recording.phase === "failed" && sessionOpen;
}

/** 이 **노트**의 전사 세션이 아직 살아 있는가. */
export function isNoteRecordingActive(
  recording: Pick<RecordingContextValue, "activeNoteId" | "session" | "phase">,
  noteId: string
): boolean {
  return recording.activeNoteId === noteId && isRecordingLive(recording);
}

/**
 * 이 **워크스페이스**에서 녹음이 돌고 있는가 — 나가기를 막고, 추방당하면 정리할 대상인지를
 * 가른다.
 *
 * **다른 워크스페이스의 녹음까지 여기 걸리면 안 된다.** 녹음은 route를 넘어 살아 있어서
 * (`RecordingProvider`가 `app/providers.tsx`에 있다) A를 녹음한 채 B를 볼 수 있고, 그때
 * B의 나가기를 잠그면 틀린 잠금이다.
 */
export function isWorkspaceRecordingActive(
  recording: Pick<
    RecordingContextValue,
    "activeWorkspaceId" | "session" | "phase"
  >,
  workspaceId: string
): boolean {
  return (
    recording.activeWorkspaceId === workspaceId && isRecordingLive(recording)
  );
}

/**
 * `stop()`이 이 노트의 녹음을 곱게 끝낼 수 있는가 — **연결돼 녹음 중일 때(`recording`)만**이다.
 * `requesting-permission`/`connecting`은 `start()`가 아직 세션을 만드는 중이고 취소 안전하지
 * 않아, 여기서 `stop()`을 부르면 컨트롤러만 닫히고 시작 흐름이 이어져 고아 세션을 남긴다 —
 * 그래서 stoppable이 아니라 "차단(대기)"으로 둔다. `stopping`은 이미 멈추는 중, `failed`는
 * 컨트롤러가 비어 no-op이라 모두 빠진다.
 */
export function isRecordingStoppable(
  recording: Pick<RecordingContextValue, "activeNoteId" | "phase">,
  noteId: string
): boolean {
  return recording.activeNoteId === noteId && recording.phase === "recording";
}

/**
 * 이 노트의 녹음이 아직 시작 중인가(권한 요청·연결). **이 창에서는 회의를 끝내면 안 된다** —
 * 서버 세션이 아직 없어 종료가 성공해 버리고, 진행 중인 start()가 이어져 종료된 노트에 고아
 * 전사 세션을 만든다. 연결이 끝나 `recording`이 되면 곱게 중지한 뒤 종료할 수 있다.
 */
export function isRecordingStarting(
  recording: Pick<RecordingContextValue, "activeNoteId" | "phase">,
  noteId: string
): boolean {
  return (
    recording.activeNoteId === noteId &&
    (recording.phase === "requesting-permission" ||
      recording.phase === "connecting")
  );
}

function getStartErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  const name = cause instanceof Error ? cause.name : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "마이크 권한이 필요합니다. 브라우저 설정에서 마이크 사용을 허용해 주세요.";
  }

  if (name === "NotFoundError") {
    return "사용할 수 있는 마이크를 찾지 못했습니다.";
  }

  if (
    message === "WEBSOCKET_CLOSED" ||
    message === "WEBSOCKET_CONNECTION_FAILED" ||
    message === "STOMP_APPLICATION_READY_TIMEOUT"
  ) {
    return "실시간 스크립트 서버에 연결하지 못했습니다. 로그인 상태와 서버 연결을 확인해 주세요.";
  }

  if (errorCodeOf(cause) === "ACTIVE_TRANSCRIPTION_SESSION") {
    return "다른 기기에서 이 회의를 녹음하고 있어요.";
  }

  // 녹음자 기기의 리스가 식어 server 가 세션을 정리(60초)하기를 기다리는 중이다. 기다리면 된다는 것을 말한다(D-10)
  if (errorCodeOf(cause) === "RECORDER_DISCONNECTED") {
    return "녹음하던 기기와 연결이 끊겼어요. 그 기기의 녹음이 정리되면(약 1분) 녹음할 수 있어요.";
  }

  if (message === "SESSION_CREATE_FAILED") {
    return "스크립트 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  // **봉투면 서버 문구를 쓴다.** 전역 mutation 토스트를 끈 뒤로 이 문구가 유일한 안내라,
  // 여기서 접으면 `ACTIVE_TRANSCRIPTION_SESSION`(다른 탭이 이미 시작) 같은 구체적인 이유가
  // 「녹음을 시작하지 못했습니다」로 뭉개져 사용자가 같은 재시도를 반복한다.
  // 계약이 사용자에게 보일 한국어를 담고 있고, web이 코드별 문구를 다시 만들면 갈라진다
  // (rule `error-loading`). `Error`는 위에서 이미 가렸으므로 봉투일 때만 꺼낸다.
  if (errorCodeOf(cause) !== null) {
    return errorMessageOf(
      cause,
      "녹음을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요."
    );
  }

  return "녹음을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

const SUPERSEDED_MESSAGE = "다른 탭이나 기기에서 이 녹음을 이어받았습니다.";
/** 운영 503 은 1초에 풀렸다. 이만큼 이어질 때만 받아쓰기 멈춤을 알린다(D-23). */
const DEGRADED_NOTICE_AFTER_MS = 5_000;
const DROPPED_MESSAGE = "연결이 끊겨 녹음을 멈췄어요.";

/** 재개 창(30초)이 끝나 컨트롤러가 녹음을 멈췄다. 연결이 돌아와도 저절로 다시 켜지 않는다(D-04). */
const isWindowExhausted = (message: string) =>
  message.includes("다시 잇지 못했");

const lostAudio = (droppedMs: number) =>
  `이 기기에 남은 소리 ${Math.max(1, Math.round(droppedMs / 1_000))}초를 올리지 못했어요.`;

function getRuntimeFailureMessage(message: string, droppedMs: number) {
  if (isWindowExhausted(message)) {
    return droppedMs > 0
      ? `${DROPPED_MESSAGE} ${lostAudio(droppedMs)}`
      : DROPPED_MESSAGE;
  }
  if (message.includes("완료 응답") || message.includes("종료 요청")) {
    return droppedMs > 0
      ? `마지막 기록을 정리하지 못해 ${lostAudio(droppedMs)}`
      : "마지막 기록을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "실시간 스크립트 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * **타입을 계약으로 좁힌다.** `string` 이던 동안 exhaustive 검사가 죽어 있었고, 값이 늘어도
 * 아무 데서도 안 알려줬다.
 *
 * **`MEETING_ENDED` 를 오류로 말하지 않는다** (APP-685). 남이 회의를 끝낸 것은 정상이고,
 * 권한이 시작자에서 「멤버 누구나」로 열리면서 **자주 일어나게 됐다.** 전에는 「서버에서
 * 스크립트 세션이 중단되었습니다」로 떨어져서, 정상적으로 끝난 회의가 녹음하던 사람에게는
 * 장애로 보였다. `MEETING_PAUSED` 도 같다 — 누군가 회의를 멈춘 것이다.
 */
function getInterruptedMessage(
  endReason: TranscriptionSessionResponseDataEndReason
) {
  switch (endReason) {
    case "MEETING_ENDED":
      return "회의가 종료되어 기록을 마쳤습니다.";
    case "MEETING_PAUSED":
      return "회의가 일시중지되어 기록을 멈췄습니다.";
    case "STT_PROVIDER_ERROR":
      return "음성 인식 서비스 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요.";
    case "CLIENT_DISCONNECTED":
      return "실시간 연결이 종료되어 녹음을 중단했습니다.";
    case "READY_TIMEOUT":
      return "녹음을 시작하지 못해 세션이 만료되었습니다. 다시 시도해 주세요.";
    case "HEARTBEAT_TIMEOUT":
      return "연결이 끊긴 채로 오래 있어 기록을 중단했습니다.";
    case "CLIENT_PROTOCOL_ERROR":
    case "INTERNAL_ERROR":
    case null:
      return "서버에서 스크립트 세션이 중단되었습니다.";
  }
}

/** 끊긴 사이 회의가 끝나면 이 기기에 남은 소리는 올릴 세션이 없다(D-10). */
function meetingEndedMessage(pendingMs: number) {
  return pendingMs > 0
    ? `회의가 끝나 ${lostAudio(pendingMs)}`
    : getInterruptedMessage("MEETING_ENDED");
}

function getWebSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const baseUrl = shouldEnableMocking()
    ? `${protocol}//${window.location.host}`
    : apiBaseUrl
      ? apiBaseUrl.replace(/^http/, "ws").replace(/\/$/, "")
      : `${protocol}//${window.location.host}`;
  return `${baseUrl}/ws/transcriptions`;
}

const browserRuntime: RecordingRuntime = {
  createSession: (options) => new BrowserRealtimeSession(options),
};

export function RecordingProvider({
  children,
  api: apiOverride,
  runtime = browserRuntime,
  enablePolling = true,
}: {
  children: React.ReactNode;
  api?: RecordingApi;
  runtime?: RecordingRuntime;
  enablePolling?: boolean;
}) {
  const queryClient = useQueryClient();
  /**
   * **전역 mutation 토스트를 끈다.** 시작 실패의 문구는 이 프로바이더가 소유한다 —
   * 일반 실패는 `error`를 채워 `RecordingErrorToast`가 띄우고, 추방은 `notifyWorkspaceGone()`이
   * 띄운다. opt-out하지 않으면 `MutationCache.onError`가 서버 문구를 먼저 얹어 **같은 실패에
   * 토스트가 둘 뜬다**(rule `error-loading`의 「호출부가 이미 자기 토스트를 띄운다」).
   */
  const startSessionMutation = useStartTranscriptionSession({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [session, setSession] = useState<LocalRecordingSession | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null
  );
  const [phase, setPhaseState] = useState<RecordingPhase>("idle");
  const loggedPhaseRef = useRef<RecordingPhase>("idle");
  /** 전이마다 콘솔 줄을 남긴다. 한 act 안의 연쇄 전이도 빠짐없이 남기려고 effect 가 아니라 여기서 센다. */
  const setPhase = useCallback((next: RecordingPhase) => {
    if (loggedPhaseRef.current !== next) {
      logTranscription("phase", { from: loggedPhaseRef.current, to: next });
      loggedPhaseRef.current = next;
    }
    setPhaseState(next);
  }, []);
  const [transcript, dispatchTranscript] = useReducer(
    transcriptReducer,
    initialTranscriptState
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [levelHistory, setLevelHistory] = useState<number[]>(() =>
    Array(24).fill(0)
  );
  const [error, setError] = useState<string | null>(null);
  const [transcriptionDegraded, setTranscriptionDegraded] = useState(false);
  const degradedTimerRef = useRef<number | undefined>(undefined);
  const [connectionNotice, setConnectionNotice] =
    useState<ConnectionNotice | null>(null);
  const [buffer, setBuffer] = useState<BufferState | null>(null);
  const [microphone, setMicrophone] = useState<MicrophoneState>("live");
  /** 회의가 끝났다는 폴링을 받았을 때 이 기기에 남은 소리와 끊김 여부를 본다. */
  const bufferRef = useRef<BufferState | null>(null);
  const noticeRef = useRef<ConnectionNotice | null>(null);
  /** 재개 창이 끝나 버린 소리. 버리는 순간 버퍼가 0 이 되므로 따로 든다. */
  const droppedMsRef = useRef(0);
  const sessionRef = useRef<LocalRecordingSession | null>(null);
  const controllerRef = useRef<RealtimeSessionController | null>(null);
  const cancelledControllerRef = useRef<RealtimeSessionController | null>(null);
  const stopPromiseRef = useRef<Promise<boolean> | null>(null);
  /**
   * `disconnect()`가 몇 번 돌았나. **진행 중인 `start()`가 자기 결과를 되돌려 놓아도 되는지**를
   * 가른다 — 값이 바뀌었으면 그 사이에 통째로 정리됐다는 뜻이라 아무것도 쓰지 않는다.
   *
   * `cancelled()`만으로는 부족하다. 그쪽은 "이 컨트롤러가 더 이상 주인이 아니다"까지만 알고,
   * 그때 세션을 **일부러 저장한다** — 사용자가 직접 취소한 경우 서버에 열린 READY 세션이
   * 남았음을 독이 알려야 하기 때문이다(`recording-dock`이 그걸 보고 「닫기」를 숨긴다).
   * 강제 정리는 반대다. 화면은 이미 떠났고 phase도 `idle`이라 폴링이 안 도는데 세션만
   * 되살아나면, 아무도 안 보는 고아 상태가 만료될 때까지 남는다(codex 리뷰 2회차).
   */
  const teardownCountRef = useRef(0);
  const smoothedLevelRef = useRef(0);
  const hasOpenSession =
    session?.status === "READY" || session?.status === "ACTIVE";
  const shouldPoll =
    enablePolling &&
    Boolean(session?.sessionId) &&
    (ACTIVE_PHASES.has(phase) || (phase === "failed" && hasOpenSession));
  const sessionQuery = useGetTranscriptionSession(session?.sessionId ?? "", {
    query: {
      enabled: shouldPoll,
      staleTime: 0,
      refetchInterval: shouldPoll ? 3_000 : false,
      // **탭이 안 보여도 계속 묻는다.** 기본값(false)이면 숨긴 탭에서 타이머가 멈추는데,
      // 녹음 중에는 그동안에도 **마이크와 소켓이 살아 있다.** 추방당한 사실을 다시 포커스할
      // 때까지 모르면 권한이 사라진 노트로 음성이 계속 나간다 — 아래 정리 effect가 이
      // 조회를 신호로 쓰므로 여기서 멈추면 그 정리도 같이 멈춘다(codex 리뷰 2회차).
      //
      // 3초 요청이 배경에서도 도는 비용은 이 상황에서만 발생하고, 같은 탭이 이미 오디오를
      // WebSocket으로 흘려보내는 중이라 그 옆에서는 무시할 만하다.
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    },
  });
  /**
   * 창이 끝나 멈추면 세션이 INTERRUPTED 라 위 폴링이 멎는다. 그 뒤 남이 회의를 끝내도 녹음자는
   * 몰라서 버린 소리를 말할 수 없다(D-10). 노트 화면과 같은 캐시를 같은 주기로 물어, 종료를 알면
   * 노트 화면도 독을 걷는다. 끝을 알거나 [다시 녹음]·닫기로 문구가 바뀌면 멎는다.
   */
  const watchMeetingEnd =
    enablePolling &&
    phase === "failed" &&
    Boolean(error?.startsWith(DROPPED_MESSAGE)) &&
    activeNoteId !== null;
  const droppedNoteQuery = useGetNote(activeNoteId ?? "", {
    query: {
      enabled: watchMeetingEnd,
      refetchInterval: watchMeetingEnd ? 3_000 : false,
      refetchIntervalInBackground: true,
    },
  });
  const droppedNoteResponse = droppedNoteQuery.data;
  const meetingEndedAfterDrop =
    watchMeetingEnd &&
    droppedNoteResponse?.status === 200 &&
    droppedNoteResponse.data.data?.meetingStatus === "ENDED";

  useEffect(() => {
    if (!meetingEndedAfterDrop) return;
    const timer = window.setTimeout(() => {
      const droppedMs = droppedMsRef.current;
      logTranscription("notice", {
        state: "shown",
        cause: "meeting_ended_after_drop",
        droppedMs,
      });
      setError(meetingEndedMessage(droppedMs));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [meetingEndedAfterDrop]);

  useEffect(() => {
    bufferRef.current = buffer;
    noticeRef.current = connectionNotice;
  }, [buffer, connectionNotice]);

  useEffect(() => () => window.clearTimeout(degradedTimerRef.current), []);

  /** 늦게 도는 5초 타이머가 끝난 녹음에 멈춤 알림을 되살리지 않게 녹음이 끝나는 모든 길에서 부른다. */
  const clearDegraded = useCallback(() => {
    window.clearTimeout(degradedTimerRef.current);
    degradedTimerRef.current = undefined;
    setTranscriptionDegraded(false);
  }, []);

  const liveNoteId =
    activeNoteId && isRecordingLive({ phase, session }) ? activeNoteId : null;
  // 새로고침한 탭의 첫 상태가 idle 이다. 그때 지우면 독이 제 녹음에 잠기고, 식게 두면 다른 탭이
  // 산 탭의 ID 를 이어받는다. 그래서 idle 은 제 기록의 박동만 이어 간다.
  useEffect(() => {
    if (!liveNoteId && phase !== "idle") {
      forgetRecording();
      return;
    }
    const beat = () =>
      liveNoteId ? beatRecording(liveNoteId) : touchRecording();
    beat();
    const timer = window.setInterval(beat, RECORDING_BEAT_MS);
    window.addEventListener("pagehide", expireRecording);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", expireRecording);
    };
  }, [liveNoteId, phase]);

  const setCurrentSession = useCallback(
    (next: LocalRecordingSession | null) => {
      sessionRef.current = next;
      setSession(next);
    },
    []
  );

  const publishLevel = useCallback((nextLevel: number) => {
    const previous = smoothedLevelRef.current;
    const factor = nextLevel > previous ? 0.72 : 0.2;
    const smoothed = previous + (nextLevel - previous) * factor;
    smoothedLevelRef.current = smoothed;
    setLevel(smoothed);
    setLevelHistory((history) => [...history.slice(1), smoothed]);
  }, []);

  const clearLevel = useCallback(() => {
    smoothedLevelRef.current = 0;
    setLevel(0);
    setLevelHistory(Array(24).fill(0));
  }, []);

  const api = useMemo<RecordingApi>(
    () =>
      apiOverride ?? {
        startSession: async (noteId) => {
          const response = await startSessionMutation.mutateAsync({
            noteId,
            data: { clientInstanceId: clientInstanceId() },
          });
          // 200 은 같은 사용자가 이미 연 READY 세션을 돌려받은 것이다(멱등)
          const opened = response.status === 201 || response.status === 200;
          if (!opened || !response.data.success || !response.data.data) {
            throw new Error("SESSION_CREATE_FAILED");
          }
          return response.data.data;
        },
      },
    [apiOverride, startSessionMutation]
  );

  const invalidateTranscriptQueries = useCallback(
    (noteId: string) => {
      void queryClient.invalidateQueries({
        queryKey: getGetNoteTranscriptQueryKey(noteId),
      });
    },
    [queryClient]
  );

  const invalidateNoteListQueries = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: ({ queryKey }) => isNoteListQueryKey(queryKey),
    });
  }, [queryClient]);

  const invalidateLifecycleQueries = useCallback(
    (noteId: string, transcript = false) => {
      void queryClient.invalidateQueries({
        queryKey: getGetNoteQueryKey(noteId),
      });
      invalidateNoteListQueries();
      if (transcript) invalidateTranscriptQueries(noteId);
    },
    [invalidateNoteListQueries, invalidateTranscriptQueries, queryClient]
  );

  const failRecording = useCallback(
    (message: string) => {
      dispatchTranscript({ type: "clear-partials" });
      clearDegraded();
      setError(message);
      setPhase("failed");
      setConnectionNotice(null);
      clearLevel();
      const controller = controllerRef.current;
      controllerRef.current = null;
      void controller?.close();
      const current = sessionRef.current;
      if (current) invalidateTranscriptQueries(current.noteId);
    },
    [clearDegraded, clearLevel, invalidateTranscriptQueries, setPhase]
  );

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      if (
        event.type === "completed" &&
        event.sessionId !== sessionRef.current?.sessionId
      ) {
        return;
      }
      dispatchTranscript(event);

      if (event.type === "final" && sessionRef.current) {
        invalidateTranscriptQueries(sessionRef.current.noteId);
      }

      if (event.type === "capture_state") {
        // LIVE 는 새 업체 연결이 처음 답할 때 온다. 무응답 동안은 DEGRADED 가 이어진다
        window.clearTimeout(degradedTimerRef.current);
        degradedTimerRef.current = undefined;
        if (event.state === "DEGRADED") {
          degradedTimerRef.current = window.setTimeout(() => {
            degradedTimerRef.current = undefined;
            logTranscription("notice", { state: "shown", cause: "degraded" });
            setTranscriptionDegraded(true);
          }, DEGRADED_NOTICE_AFTER_MS);
        } else {
          setTranscriptionDegraded((shown) => {
            if (shown) {
              logTranscription("notice", {
                state: "cleared",
                cause: "degraded",
              });
            }
            return false;
          });
        }
      }

      if (event.type === "completed") {
        const current = sessionRef.current;
        if (current) {
          setCurrentSession({
            ...current,
            status: "COMPLETED",
            endedAt: new Date().toISOString(),
          });
          invalidateLifecycleQueries(current.noteId, true);
        }
        setPhase("completed");
        clearDegraded();
        clearLevel();
      }

      // 재시도할 만한 오류는 컨트롤러가 같은 세션에 다시 붙어 푼다. 녹음을 끝내지 않는다.
      if (event.type === "error" && isTerminalError(event)) {
        // 계약이 사용자에게 보일 한국어 메시지를 담고 있다(message: min 1). 코드별로 다시
        // 쓰면 서버가 바뀔 때마다 갈라진다 — rule error-loading "문구는 서버 것을 쓴다".
        // 회의 종료만은 이 기기에 남은 소리를 같이 말해야 해서 web 이 만든다
        failRecording(
          event.reason === "MEETING_ENDED"
            ? meetingEndedMessage(bufferRef.current?.pendingMs ?? 0)
            : event.message
        );
      }

      // 이 세션은 이제 다른 탭·기기의 것이다. 들고 있으면 이 탭이 회의 제어를 막는다.
      if (event.type === "superseded") {
        failRecording(SUPERSEDED_MESSAGE);
        setCurrentSession(null);
      }
    },
    [
      setPhase,
      clearDegraded,
      clearLevel,
      failRecording,
      invalidateLifecycleQueries,
      invalidateTranscriptQueries,
      setCurrentSession,
    ]
  );

  useEffect(() => {
    const response = sessionQuery.data;
    const serverSession =
      response?.status === 200 && response.data.success
        ? response.data.data
        : undefined;
    if (
      !serverSession ||
      serverSession.sessionId !== sessionRef.current?.sessionId
    ) {
      return;
    }

    if (serverSession.status === "ACTIVE") {
      controllerRef.current?.reconcile("ACTIVE");
      return;
    }
    const reconcileTimer = window.setTimeout(() => {
      if (serverSession.status === "COMPLETED" && phase !== "completed") {
        const controller = controllerRef.current;
        controller?.reconcile("COMPLETED");
        if (!stopPromiseRef.current && controllerRef.current === controller) {
          controllerRef.current = null;
        }
        dispatchTranscript({
          type: "completed",
          sessionId: serverSession.sessionId,
        });
        setCurrentSession(serverSession);
        setPhase("completed");
        clearDegraded();
        clearLevel();
        invalidateLifecycleQueries(serverSession.noteId, true);
        return;
      }
      if (serverSession.status === "INTERRUPTED") {
        // 끊김은 컨트롤러가 같은 세션에 다시 붙어 푼다. 폴링은 표시용이고, 녹음을 끝내는 것은
        // 회의 쪽 결정뿐이다. 세션이 정말 끝났으면 다시 붙을 때 서버가 in-band 로 거절한다.
        const meetingDecision =
          serverSession.endReason === "MEETING_ENDED" ||
          serverSession.endReason === "MEETING_PAUSED";
        if (ACTIVE_PHASES.has(phase) && !meetingDecision) return;
        setCurrentSession(serverSession);
        invalidateLifecycleQueries(serverSession.noteId, true);
        // 끊긴 채(또는 재부착이 거절된 뒤) 회의가 끝나면 이 기기에 남은 소리는 올릴 세션이 없다(D-10)
        // 거절 reason 이 없는 옛 server 는 이 폴링으로만 안다
        const pendingMs = bufferRef.current?.pendingMs ?? 0;
        const lostMessage =
          serverSession.endReason === "MEETING_ENDED" &&
          pendingMs > 0 &&
          (phase === "failed" || noticeRef.current?.cause === "disconnected")
            ? meetingEndedMessage(pendingMs)
            : null;
        if (phase !== "failed") {
          controllerRef.current?.reconcile("INTERRUPTED");
          failRecording(
            lostMessage ?? getInterruptedMessage(serverSession.endReason)
          );
        } else if (lostMessage) {
          setError(lostMessage);
        }
      }
    }, 0);
    return () => window.clearTimeout(reconcileTimer);
  }, [
    setPhase,
    clearDegraded,
    clearLevel,
    failRecording,
    invalidateLifecycleQueries,
    invalidateTranscriptQueries,
    phase,
    sessionQuery.data,
    setCurrentSession,
  ]);

  const start = useCallback(
    async (noteId: string, workspaceId: string) => {
      if (controllerRef.current || ACTIVE_PHASES.has(phase)) return;

      const current = sessionRef.current;
      stopPromiseRef.current = null;
      cancelledControllerRef.current = null;
      const reusableSession =
        current?.noteId === noteId &&
        current.status === "READY" &&
        Date.parse(current.readyExpiresAt) > Date.now()
          ? current
          : null;

      dispatchTranscript({ type: "reset" });
      setActiveNoteId(noteId);
      setActiveWorkspaceId(workspaceId);
      setCurrentSession(reusableSession);
      setError(null);
      // 지난 회의의 상태를 새 회의로 들고 오지 않는다
      clearDegraded();
      setConnectionNotice(null);
      setBuffer(null);
      setMicrophone("live");
      setElapsedMs(0);
      setPhase("requesting-permission");
      const teardownCount = teardownCountRef.current;
      const controller = runtime.createSession({
        url: getWebSocketUrl(),
        onEvent: handleEvent,
        onLevel: publishLevel,
        onFailure: (message, detail) => {
          // 같은 사건을 이벤트로 이미 받아 서버 문구로 끝냈다
          if (controllerRef.current !== controller) return;
          droppedMsRef.current = detail?.droppedMs ?? 0;
          failRecording(
            getRuntimeFailureMessage(message, droppedMsRef.current)
          );
          // 이 탭이 버린 세션이다. 열린 세션으로 들고 있으면 독이 남의 기록으로 읽어 [다시 녹음]을 막는다
          const dropped = sessionRef.current;
          if (isWindowExhausted(message) && dropped) {
            setCurrentSession({ ...dropped, status: "INTERRUPTED" });
          }
        },
        onNoticeChange: setConnectionNotice,
        onBufferChange: setBuffer,
        onMicrophoneChange: (state) => setMicrophone(state),
      });
      controllerRef.current = controller;
      const cancelled = () =>
        cancelledControllerRef.current === controller ||
        controllerRef.current !== controller;
      /** 그 사이 `disconnect()`가 돌았나 — 강제 정리라 상태를 되돌려 놓으면 안 된다. */
      const tornDown = () => teardownCountRef.current !== teardownCount;

      try {
        await controller.requestPermission();
        if (cancelled()) {
          await controller.close();
          return;
        }
        setPhase("connecting");
        const adopted = reusableSession ? null : adoptDeadRecorder(noteId);
        if (adopted) logTranscription("takeover", { noteId, ...adopted });
        const connectionSession =
          reusableSession ?? (await api.startSession(noteId));
        if (!reusableSession) {
          invalidateLifecycleQueries(noteId);
        }
        if (cancelled()) {
          // 사용자가 취소한 것이면 서버에 열린 READY 세션을 화면이 알아야 한다. 강제 정리면
          // 반대로 아무것도 남기지 않는다 — 넣어 두면 폴링도 안 도는 고아가 된다.
          if (!tornDown()) setCurrentSession(connectionSession);
          await controller.close();
          return;
        }
        setCurrentSession(connectionSession);
        await controller.connect(connectionSession.sessionId);
        if (cancelled()) return;
        setCurrentSession({
          ...connectionSession,
          status: "ACTIVE",
          startedAt: connectionSession.startedAt ?? new Date().toISOString(),
        });
        setPhase("recording");
      } catch (cause) {
        await controller.close();
        if (controllerRef.current !== controller) return;
        controllerRef.current = null;
        /**
         * **시작하는 사이에 쫓겨났다.** 세션 조회는 `sessionId`가 있어야 켜지므로 아직
         * 안 돈다. 그 사이에 다른 워크스페이스로 옮겼으면 화면 쪽 감지기도 언마운트돼서,
         * 이 404를 일반 실패로 처리하면 **아무도 알려주지 않고 목록 캐시도 안 고친다**
         * — 「다시 시도」만 남고 눌러도 계속 404다(codex 리뷰 4회차).
         */
        if (errorCodeOf(cause) === "WORKSPACE_NOT_FOUND") {
          notifyWorkspaceGone();
          forgetWorkspace(queryClient, workspaceId);
          setPhase("idle");
          setActiveNoteId(null);
          setActiveWorkspaceId(null);
          clearLevel();
          return;
        }
        setError(getStartErrorMessage(cause));
        setPhase("failed");
        clearLevel();
      }
    },
    [
      setPhase,
      api,
      clearDegraded,
      clearLevel,
      failRecording,
      handleEvent,
      invalidateLifecycleQueries,
      phase,
      publishLevel,
      queryClient,
      runtime,
      setCurrentSession,
    ]
  );

  const stop = useCallback((): Promise<boolean> => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    const controller = controllerRef.current;
    if (!controller) return Promise.resolve(false);
    cancelledControllerRef.current = controller;
    const attempt = (async () => {
      setPhase("stopping");
      clearLevel();
      try {
        await controller.stop();
      } catch {
        failRecording("녹음을 종료하는 중 오류가 발생했습니다.");
        return false;
      }
      const reconciled =
        controllerRef.current === controller &&
        sessionRef.current?.status === "COMPLETED";
      if (!reconciled) {
        if (controllerRef.current === controller) {
          failRecording("녹음 종료 상태를 확인하지 못했습니다.");
        }
        return false;
      }
      if (controllerRef.current === controller) controllerRef.current = null;
      return true;
    })();
    const stopPromise = attempt.then((result) => {
      if (!result && stopPromiseRef.current === stopPromise) {
        stopPromiseRef.current = null;
      }
      return result;
    });
    stopPromiseRef.current = stopPromise;
    return stopPromise;
  }, [clearLevel, failRecording, setPhase]);

  const disconnect = useCallback(async () => {
    // 진행 중인 `start()`에게 "결과를 되돌려 놓지 마라"고 알린다. 컨트롤러를 비우기 전에
    // 올려야 그 사이에 끝난 요청도 이 값을 보고 판단한다.
    teardownCountRef.current += 1;
    const controller = controllerRef.current;
    const current = sessionRef.current;
    controllerRef.current = null;
    cancelledControllerRef.current = null;
    stopPromiseRef.current = null;

    clearLevel();
    setPhase("idle");
    forgetRecording();
    setCurrentSession(null);
    setActiveNoteId(null);
    setActiveWorkspaceId(null);
    setElapsedMs(0);
    setError(null);
    clearDegraded();
    setConnectionNotice(null);
    // 남은 소리 수치가 남으면 phase 가 idle 이어도 탭 닫기를 붙잡는다
    setBuffer(null);
    setMicrophone("live");
    droppedMsRef.current = 0;
    dispatchTranscript({ type: "reset" });

    await controller?.close();
    if (current) invalidateTranscriptQueries(current.noteId);
  }, [
    clearDegraded,
    clearLevel,
    invalidateTranscriptQueries,
    setCurrentSession,
    setPhase,
  ]);

  /**
   * 녹음 중에 그 워크스페이스에서 쫓겨났으면 **보고 있는 화면과 무관하게** 끊는다.
   *
   * 화면 쪽 감지(`useRedirectWhenWorkspaceGone`)로는 부족하다 — 그것은 지금 열려 있는
   * 워크스페이스만 본다. 녹음은 route를 넘어 살아 있어서 **A를 녹음한 채 B나 홈으로 옮길 수
   * 있고**, 그 상태로 A에서 추방되면 아무 화면도 A를 보고 있지 않아 마이크와 소켓이 그대로
   * 남는다. 이미 접근할 수 없는 노트로 음성이 계속 나가는 것이 이 이슈의 본체다.
   *
   * 여기서는 **자기 세션 조회**가 신호다. 그 조회도 비멤버에게는 같은 404를 준다
   * (`NoteAccessHandler.requireProjectMember` → `WorkspaceNotFoundException`). 3초 주기라
   * 화면 폴링(30초)보다 빠르고, 어느 워크스페이스인지 맞혀 볼 필요도 없다 — 실패한 조회가
   * 곧 이 녹음의 것이다.
   *
   * `stop()`이 아니라 `disconnect()`다. 이미 비멤버라 세션 종료 API도 404로 떨어진다.
   */
  useEffect(() => {
    // `error`는 재시도를 다 소진해야 채워지고 그 전에 `paused`로 멈출 수 있다(APP-385).
    // 404는 다시 물어도 답이 같으니 첫 실패를 본다.
    const gone =
      errorCodeOf(sessionQuery.error) === "WORKSPACE_NOT_FOUND" ||
      errorCodeOf(sessionQuery.failureReason) === "WORKSPACE_NOT_FOUND";
    if (!gone) return;
    // **말없이 사라지지 않게 한다.** 화면이 다른 워크스페이스에 있으면 이 경로만 404를 보고,
    // 그대로 두면 녹음 표시가 이유 없이 없어진다. 보고 있던 중이었다면 화면 쪽도 같은 사건을
    // 알리는데, 같은 id를 써서 토스트는 하나만 남는다.
    notifyWorkspaceGone();
    // **캐시에서도 걷어낸다.** 화면이 그 워크스페이스에 없으면 `useRedirectWhenWorkspaceGone`이
    // 마운트돼 있지 않아 아무도 목록을 안 고친다 — 사이드바와 홈이 이미 죽은 워크스페이스를
    // 계속 그리고, 누르면 다시 들어갔다가 쫓겨난다(codex 리뷰 4회차).
    // `disconnect()`가 `activeWorkspaceId`를 비우므로 그 전에 읽어 둔다.
    if (activeWorkspaceId) forgetWorkspace(queryClient, activeWorkspaceId);
    // 정리를 다음 틱으로 미룬다. `disconnect()`가 상태를 여럿 되돌리는데 effect 본문에서
    // 바로 부르면 렌더 중 연쇄가 된다(`react-hooks/set-state-in-effect`). 위 종료 reconcile도
    // 같은 이유로 타이머를 거친다.
    const timer = window.setTimeout(() => void disconnect(), 0);
    return () => window.clearTimeout(timer);
  }, [
    activeWorkspaceId,
    disconnect,
    queryClient,
    sessionQuery.error,
    sessionQuery.failureReason,
  ]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => {
      setElapsedMs((previous) => previous + 1000);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(
    () => () => {
      void controllerRef.current?.close();
    },
    []
  );

  // 멈췄거나 실패했어도 서버가 확정 안 한 소리가 남아 있으면 붙잡는다
  const holdTab = ACTIVE_PHASES.has(phase) || (buffer?.pendingMs ?? 0) > 0;
  /** 서버가 확정 안 한 소리가 있는 동안 탭을 닫으면 붙잡는다. 닫으면 그 소리는 사라진다(D-05). */
  useEffect(() => {
    if (!holdTab) return;
    const hold = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [holdTab]);

  const value = useMemo<RecordingContextValue>(
    () => ({
      session,
      activeNoteId,
      activeWorkspaceId,
      phase,
      elapsedMs,
      transcriptionDegraded,
      connectionNotice,
      buffer,
      microphone,
      error,
      start,
      stop,
      disconnect,
    }),
    [
      session,
      activeNoteId,
      activeWorkspaceId,
      phase,
      elapsedMs,
      transcriptionDegraded,
      connectionNotice,
      buffer,
      microphone,
      error,
      start,
      stop,
      disconnect,
    ]
  );
  const meterValue = useMemo<RecordingMeterValue>(
    () => ({ level, levelHistory }),
    [level, levelHistory]
  );

  return (
    <RecordingContext.Provider value={value}>
      <RecordingTranscriptContext.Provider value={transcript}>
        <RecordingMeterContext.Provider value={meterValue}>
          {children}
        </RecordingMeterContext.Provider>
      </RecordingTranscriptContext.Provider>
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const value = useContext(RecordingContext);
  if (!value) {
    throw new Error("useRecording must be used inside RecordingProvider.");
  }
  return value;
}

export function useRecordingMeter() {
  const value = useContext(RecordingMeterContext);
  if (!value) {
    throw new Error("useRecordingMeter must be used inside RecordingProvider.");
  }
  return value;
}

export function useRecordingTranscript() {
  const value = useContext(RecordingTranscriptContext);
  if (!value) {
    throw new Error(
      "useRecordingTranscript must be used inside RecordingProvider."
    );
  }
  return value;
}
