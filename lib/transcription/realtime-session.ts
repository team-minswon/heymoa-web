import {
  PcmAudioCapture,
  type MicrophoneState,
} from "@/lib/transcription/audio";
import {
  CAPTURE_CONTRACT,
  CAPTURE_TUNING,
} from "@/lib/transcription/capture-config";
import { logTranscription } from "@/lib/transcription/log";
import {
  isTerminalError,
  type ServerEvent,
} from "@/lib/transcription/protocol";
import { ResendBuffer, type CatchUp } from "@/lib/transcription/resend-buffer";
import {
  TranscriptionSocket,
  type ReconnectReason,
  type TranscriptionSocketOptions,
} from "@/lib/transcription/socket";

type AudioPort = Pick<PcmAudioCapture, "requestPermission" | "start" | "stop">;
type SocketPort = Pick<
  TranscriptionSocket,
  "connect" | "sendAudio" | "stop" | "close" | "reconcileConnected"
>;

export type RealtimeSessionStatus = "ACTIVE" | "COMPLETED" | "INTERRUPTED";

export type RealtimeSessionController = {
  requestPermission: () => Promise<void>;
  connect: (sessionId: string) => Promise<void>;
  stop: () => Promise<void>;
  reconcile: (status: RealtimeSessionStatus) => void;
  close: () => Promise<void>;
};

/**
 * 노랑 알림(D-03). 받아쓰기와 실시간 분석이 멈췄다는 뜻이다.
 * - `disconnected`: 끊김을 알아챈 지 5초(offline 이면 곧바로). `sinceMs` 는 알아챈 시각이다.
 * - `no_receipt`: 붙어 있는데 영수증(`connected`·ack)이 10초 없다. `sinceMs` 는 마지막 영수증 시각이다.
 */
export type ConnectionNotice = {
  cause: "disconnected" | "no_receipt";
  sinceMs: number;
};

/**
 * 서버가 확정 안 한 소리가 이 기기(메모리)에 얼마나 있나.
 * - `paused`: 한도에 닿아 캡처한 소리를 받지 않는 중이다. 밀린 것이 빠지면 저절로 풀린다.
 * - `upload`: 다시 붙은 뒤나 멈춘 뒤 밀린 소리를 올리는 중. 다 보내면 null.
 */
export type BufferState = {
  pendingMs: number;
  limitMs: number;
  paused: boolean;
  upload: { percent: number; remainingMs: number } | null;
};

export type RealtimeSessionOptions = {
  url: string;
  onEvent: (event: ServerEvent) => void;
  onLevel: (level: number) => void;
  /** `droppedMs`: 재개 창이 끝나 버린 소리. 그 뒤 회의가 끝나면 「N초를 올리지 못했어요」가 쓴다. */
  onFailure: (message: string, detail?: { droppedMs: number }) => void;
  onNoticeChange?: (notice: ConnectionNotice | null) => void;
  onBufferChange?: (state: BufferState) => void;
  /** `captureGapMs`: 첫 조각 이후 벽시계에서 실제로 잡은 소리를 뺀 것. 마이크가 쉰 시간이다. */
  onMicrophoneChange?: (state: MicrophoneState, captureGapMs: number) => void;
};

export type RealtimeSessionDependencies = {
  createAudio?: (
    onChunk: (chunk: ArrayBuffer, captureSamples: number) => void,
    onLevel: (level: number) => void,
    onState: (state: MicrophoneState) => void
  ) => AudioPort;
  createSocket?: (options: TranscriptionSocketOptions) => SocketPort;
};

/** `reattach`: stop 을 보낸 부착이 끊겼거나 서버가 저장을 못 끝냈다. 다시 붙어 stop 을 다시 보낸다. */
type TerminalState = "completed" | "failed" | "timeout" | "reattach";

/** 이만큼 연속으로 한 조각도 못 보내면 회선이 죽은 것으로 보고 다시 붙는다. 실패가 아니다. */
const MAX_CONGESTION_MS = CAPTURE_TUNING.congestionMs;
/** heartbeat 가 10s 라 두 번 놓치면 끊긴 것이다. 망 먹통을 서버보다 먼저 안다. */
const SILENCE_LIMIT_MS = 20_000;
/** 소켓이 비는 대로 밀린 것을 채우고 무수신을 잰다. 조각 하나(100ms)와 같은 박자다. */
const PUMP_MS = 100;
const REATTACH_FIRST_DELAY_MS = 500;
const REATTACH_MIN_DELAY_MS = 500;
const REATTACH_MAX_DELAY_MS = 5_000;
/** 끊김을 알아챈 뒤 이만큼 다시 잇지 못하면 녹음을 멈춘다(D-02). */
const RESUME_WINDOW_MS = 30_000;
const NOTICE_AFTER_MS = 5_000;
/** S3 flush 주기(5초)의 두 배. */
const RECEIPT_LIMIT_MS = 10_000;
/** server stop 최악(S3 10초 + 업체 10초)보다 길게(D-22). */
const STOP_TIMEOUT_MS = 25_000;
/** stop 을 누른 때부터의 상한. 느린 S3 에서 다시 붙으라는 답이 이어져도 여기서 끝낸다. */
const STOP_TOTAL_MS = 60_000;
/** 이보다 짧게 살고 끊긴 부착이 이어지면 연결은 되는데 못 버티는 것이다. 다시 붙는 간격을 늘려 간다. */
const STABLE_ATTACH_MS = 10_000;
const BYTES_PER_MS =
  (CAPTURE_CONTRACT.sampleRate * CAPTURE_CONTRACT.bytesPerSample) / 1000;
const MEMORY_LIMIT_BYTES = CAPTURE_TUNING.memoryBufferMs * BYTES_PER_MS;
const SAMPLES_PER_MS = CAPTURE_CONTRACT.sampleRate / 1000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function reattachCause(serverReason: string): ReconnectReason {
  if (serverReason === "STORE_INCOMPLETE") return "store_incomplete";
  if (serverReason === "BUFFER_FULL") return "buffer_full";
  return "server_reattach";
}

/** n 번째 재시도(1부터) 전 대기. 한 태스크에 붙어 있던 녹음들이 같은 박자로 두드리지 않게 흩는다. */
function reattachDelayMs(attempt: number) {
  const ceiling = Math.min(
    REATTACH_MAX_DELAY_MS,
    REATTACH_MIN_DELAY_MS * 2 ** attempt
  );
  return (
    REATTACH_MIN_DELAY_MS + Math.random() * (ceiling - REATTACH_MIN_DELAY_MS)
  );
}

let tabInstanceId: string | null = null;
const TAB_INSTANCE_KEY = "heymoa.transcription.clientInstanceId";
/**
 * 탭 수명 동안 하나. 같은 탭의 재부착과 다른 탭·기기의 부착을 서버가 가른다.
 * 새로고침한 탭의 시작 요청도 같은 값이라 서버가 옛 세션을 리스가 살아 있어도 곧바로 닫는다(D-16).
 *
 * sessionStorage 는 opener 를 가진 새 창에도 복사된다. 같은 값이면 서버가 그 창의 시작을 이 탭의
 * 재시작으로 읽어 이 탭의 녹음을 닫는다. 창 이름은 새로고침에는 남고 새 창에는 안 넘어가서, 둘이
 * 맞을 때만 이어 쓴다.
 */
export function clientInstanceId() {
  if (tabInstanceId) return tabInstanceId;
  try {
    const stored = sessionStorage.getItem(TAB_INSTANCE_KEY);
    if (stored && window.name === stored) tabInstanceId = stored;
  } catch {
    // Node 실험 틀·저장소가 막힌 창
  }
  if (tabInstanceId) return tabInstanceId;
  tabInstanceId = crypto.randomUUID();
  try {
    sessionStorage.setItem(TAB_INSTANCE_KEY, tabInstanceId);
    window.name = tabInstanceId;
  } catch {
    // 위와 같다
  }
  return tabInstanceId;
}

/**
 * 녹음 한 번 = 세션 하나. 소켓은 그 세션에 붙는 부착이라 끊기면 **같은 세션에** 다시 붙고,
 * 서버가 확정한 조각 다음부터 버퍼에서 다시 보낸다. `chunkSeq` 는 녹음 내내 이어진다.
 *
 * 녹음이 실패로 끝나는 길: 재시도해도 같은 in-band 오류, 끊김을 알아챈 뒤 30초 창 소진,
 * 종료 응답 시간 초과. 창이 끝나면 캡처를 끄고 메모리 소리를 버리며 연결이 돌아와도 다시 켜지 않는다.
 * 메모리 한도(5분)는 실패가 아니다. 캡처를 멈췄다가 빠지면 다시 받는다.
 */
export class BrowserRealtimeSession implements RealtimeSessionController {
  private readonly audio: AudioPort;
  private sessionId: string | null = null;
  private socket: SocketPort | null = null;
  /** 지금 소켓이 `connected` 를 받았다. 그 전에는 보내지 않는다. */
  private attached = false;
  private reattaching: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;
  private closePromise: Promise<void> | null = null;
  private stopping = false;
  private closing = false;
  private audioStopped = false;
  private terminalEventReceived = false;
  private terminalResolve:
    | ((state: Exclude<TerminalState, "timeout">) => void)
    | null = null;
  private attachedAt = 0;
  /** 짧게 살고 끊긴 부착이 몇 번 이어졌나. */
  private churn = 0;
  private failed = false;
  private congestedSinceMs: number | null = null;
  /** 정체 동안 가장 새 3초 뒤로 넘긴 조각. 정체가 풀릴 때 한 줄로 남긴다. */
  private congestionCatchUp: CatchUp | null = null;
  private lastInboundAt = 0;
  private pumpTimer: ReturnType<typeof setInterval> | null = null;
  private nextChunkSeq = 0;
  private captureStartedAt: number | null = null;
  private capturedMs = 0;
  private resendBuffer!: ResendBuffer;
  /** 올리기 진행률의 분모. 다시 붙거나 멈출 때 남은 양으로 잡는다. */
  private uploadBaselineBytes: number | null = null;
  private lastBufferKey = "";
  /** 끊김을 알아챈 시각. 소켓 닫힘·무수신·정체·reattach·offline 중 가장 이른 것이고 `connected` 에서 지운다. */
  private disconnectedSince: number | null = null;
  private disconnectDetail = "";
  private reconnectReason: ReconnectReason = "initial";
  private offline = false;
  private lastAckAt = 0;
  private notice: ConnectionNotice | null = null;
  /** 재시도 대기를 곧바로 끝낸다. online 이 쓴다. */
  private wakeRetry: (() => void) | null = null;
  private readonly handleOffline = () => {
    logTranscription("offline");
    this.offline = true;
    this.disconnectedSince ??= Date.now();
    this.updateNotice();
  };
  private readonly handleOnline = () => {
    logTranscription("online");
    this.offline = false;
    if (this.wakeRetry) {
      this.reconnectReason = "online";
      this.wakeRetry();
    } else if (this.attached && !this.reattaching) {
      this.disconnectedSince = null;
      this.updateNotice();
    }
  };

  constructor(
    private readonly options: RealtimeSessionOptions,
    private readonly dependencies: RealtimeSessionDependencies = {}
  ) {
    const createAudio =
      dependencies.createAudio ??
      ((onChunk, onLevel, onState) =>
        new PcmAudioCapture({ onChunk, onLevel, onState }));
    this.audio = createAudio(
      (chunk, captureSamples) => this.enqueueAudio(chunk, captureSamples),
      options.onLevel,
      (state) =>
        options.onMicrophoneChange?.(state, this.captureGapMs(Date.now()))
    );
  }

  async requestPermission() {
    await this.audio.requestPermission();
    await this.rejectIfStopped();
  }

  async connect(sessionId: string) {
    if (this.stopping || this.closing) {
      throw new Error("REALTIME_SESSION_CLOSED");
    }
    if (this.sessionId) throw new Error("REALTIME_SESSION_ALREADY_CONNECTED");
    this.sessionId = sessionId;
    this.resendBuffer = new ResendBuffer({ limitBytes: MEMORY_LIMIT_BYTES });
    window.addEventListener("offline", this.handleOffline);
    window.addEventListener("online", this.handleOnline);
    await this.attach();
    await this.rejectIfStopped();
    // 폴링(ACTIVE)이 connect() 를 먼저 풀었다. connected 없이는 어디까지 저장됐는지 몰라 보낼 수 없다
    if (!this.attached) void this.reattach("no_receive", "connected missing");
    await this.audio.start();
    await this.rejectIfStopped();
    this.startPump();
  }

  private startPump() {
    this.pumpTimer = setInterval(() => {
      this.flushPending();
      this.checkSilence();
      if (this.checkWindow()) return;
      this.updateNotice();
    }, PUMP_MS);
  }

  stop() {
    this.stopping = true;
    this.stopPromise ??= this.stopOnce();
    return this.stopPromise;
  }

  /**
   * 서버는 `finalChunkSeq` 까지 저장한 뒤에만 completed 를 보낸다. 못 끝냈거나 stop 을 보낸 부착이 끊기면 다시 붙어
   * 이어 보내고 stop 을 다시 보낸다. 끊긴 채면 30초 창 안에서만 기다린다.
   */
  private async stopOnce() {
    if (this.closing) return this.closePromise ?? Promise.resolve();
    const since = Date.now();
    const deadline = since + STOP_TOTAL_MS;
    /** stop 경로의 모든 기다림은 이것을 거친다. 조금씩 나가는 올리기나 끝나지 않는 부착이 상한을 넘기지 못한다. */
    const untilDeadline = (work: Promise<unknown>) =>
      Promise.race([work, sleep(Math.max(0, deadline - Date.now()))]);
    // Browser audio cleanup can reject after the final PCM batch was flushed
    // (for example when AudioContext was already closed). The server stop must
    // still be sent so an ACTIVE session is not left behind.
    await untilDeadline(this.stopAudio().catch(() => undefined));
    let reattaches = 0;
    const closeUnattached = () => {
      logTranscription("stop", {
        step: "closed_unattached",
        elapsedMs: Date.now() - since,
        reattaches,
      });
      return this.close();
    };
    for (;;) {
      // 다시 잇는 중이면 이은 뒤에 남은 소리를 보내고 멈춘다
      if (this.reattaching) await untilDeadline(this.reattaching);
      if (Date.now() >= deadline) break;
      if (!this.socket || !this.attached) return closeUnattached();
      // 회의 끝이 올리기 끝이 아니다. 밀린 것을 다 건넨 뒤에 stop 을 보낸다
      await this.sendAllForStop(deadline);
      if (Date.now() >= deadline) break;
      const socket = this.socket;
      if (this.closing || !socket || !this.attached) return closeUnattached();
      const remainingMs = deadline - Date.now();
      const state =
        remainingMs > 0
          ? await this.sendStop(socket, Math.min(STOP_TIMEOUT_MS, remainingMs))
          : "timeout";
      if (state === "reattach" && Date.now() < deadline) {
        reattaches += 1;
        continue;
      }
      if (state === "reattach" || state === "timeout") {
        if (Date.now() >= deadline) break;
        this.failStop();
      }
      await this.close();
      return;
    }
    logTranscription("stop", {
      step: "timeout",
      scope: "total",
      elapsedMs: Date.now() - since,
      reattaches,
      unsentMs: Math.round(
        (this.resendBuffer?.unsentBytes ?? 0) / BYTES_PER_MS
      ),
      droppedMs: Math.round(this.resendBuffer.bytes / BYTES_PER_MS),
    });
    this.failStop();
    await this.close();
  }

  /** 닫으면 들고 있던 소리는 보낼 곳이 없다. 양을 알리고 버려야 탭 닫기 붙잡기도 풀린다(D-26). */
  private failStop() {
    const droppedMs = Math.round(this.resendBuffer.bytes / BYTES_PER_MS);
    this.resendBuffer.ackThrough(Number.MAX_SAFE_INTEGER);
    this.reportBuffer();
    this.fail("스크립트 완료 응답을 기다리는 중 시간이 초과되었습니다.", {
      droppedMs,
    });
  }

  /** 막힌 소켓은 정체 감시가 다시 붙이고, 끊긴 채 30초면 창이 닫는다. 조금씩 나가는 소켓은 deadline 이 끊는다. */
  private async sendAllForStop(deadline: number) {
    const unsent = this.resendBuffer.unsentBytes;
    if (unsent > 0) {
      this.uploadBaselineBytes ??= unsent;
      this.reportBuffer();
    }
    while (this.resendBuffer.unsentBytes > 0) {
      if (this.closing || this.failed || Date.now() >= deadline) return;
      await sleep(PUMP_MS);
    }
  }

  private async sendStop(
    socket: SocketPort,
    timeoutMs: number
  ): Promise<TerminalState> {
    const terminal = new Promise<Exclude<TerminalState, "timeout">>(
      (resolve) => {
        this.terminalResolve = resolve;
      }
    );
    const finalChunkSeq = this.nextChunkSeq - 1;
    try {
      this.flushPending();
      socket.stop(finalChunkSeq);
    } catch {
      this.terminalResolve = null;
      this.fail("스크립트 종료 요청을 서버에 보내지 못했습니다.");
      return "failed";
    }
    const sentAt = Date.now();
    logTranscription("stop", {
      step: "wait",
      finalChunkSeq,
      timeoutMs,
    });
    let timeoutId: ReturnType<typeof globalThis.setTimeout>;
    const timeout = new Promise<"timeout">((resolve) => {
      timeoutId = globalThis.setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const state = await Promise.race<TerminalState>([terminal, timeout]);
    globalThis.clearTimeout(timeoutId!);
    this.terminalResolve = null;
    logTranscription("stop", {
      step: "result",
      result: state,
      waitMs: Date.now() - sentAt,
    });
    return state;
  }

  reconcile(status: RealtimeSessionStatus) {
    if (status === "ACTIVE") {
      // 세션은 끊긴 동안에도 ACTIVE 다. 다시 붙는 부착을 connected 보다 먼저 풀면 stop 이 소켓을 닫는다
      if (!this.reattaching) this.socket?.reconcileConnected();
      return;
    }
    this.terminalResolve?.(status === "COMPLETED" ? "completed" : "failed");
    void this.close();
  }

  close() {
    if (this.closing) return this.closePromise ?? Promise.resolve();
    this.closing = true;
    if (this.pumpTimer) clearInterval(this.pumpTimer);
    window.removeEventListener("offline", this.handleOffline);
    window.removeEventListener("online", this.handleOnline);
    this.wakeRetry?.();
    this.disconnectedSince = null;
    this.updateNotice();
    this.terminalResolve?.("failed");
    this.terminalResolve = null;
    const socket = this.socket;
    this.socket = null;
    this.attached = false;
    this.closePromise = Promise.allSettled([
      this.stopAudio(),
      socket?.close() ?? Promise.resolve(),
    ]).then(() => undefined);
    return this.closePromise;
  }

  private async attach() {
    const createSocket =
      this.dependencies.createSocket ??
      ((socketOptions) => new TranscriptionSocket(socketOptions));
    const reconnectReason = this.reconnectReason;
    const disconnectedMs =
      this.disconnectedSince === null ? 0 : Date.now() - this.disconnectedSince;
    const pendingChunks = this.resendBuffer.count;
    logTranscription("reconnect", {
      step: "attempt",
      reason: reconnectReason,
      disconnectedMs,
      pendingChunks,
    });
    const socket: SocketPort = createSocket({
      url: this.options.url,
      sessionId: this.sessionId!,
      clientInstanceId: clientInstanceId(),
      resendFromSeq: this.resendBuffer.firstSeq ?? this.nextChunkSeq,
      reconnectReason,
      disconnectedMs,
      pendingChunks,
      onEvent: (event) => this.handleEvent(socket, event),
      onActivity: () => {
        if (socket === this.socket) this.lastInboundAt = Date.now();
      },
      onClose: (code, reason) => this.handleClose(socket, code, reason),
    });
    this.socket = socket;
    this.attached = false;
    this.congestedSinceMs = null;
    this.lastInboundAt = Date.now();
    try {
      await socket.connect();
    } catch (error) {
      logTranscription("reconnect", {
        step: "result",
        ok: false,
        reason: reconnectReason,
        error: error instanceof Error ? error.message : String(error),
      });
      this.dropSocket(socket);
      throw error;
    }
  }

  /** 버린 소켓은 기다리지 않는다. 망이 죽었으면 닫는 인사도 안 끝난다. */
  private dropSocket(socket: SocketPort | null) {
    if (!socket) return;
    if (this.socket === socket) {
      this.socket = null;
      this.attached = false;
    }
    void socket.close().catch(() => undefined);
  }

  private handleClose(socket: SocketPort, code: number, reason: string) {
    // 버린 소켓이 늦게 닫혔거나, 붙기 전에 닫혔다. 붙기 전 실패는 connect() 의 reject 가 맡는다.
    if (socket !== this.socket || this.reattaching || !this.attached) return;
    if (this.terminalEventReceived) {
      void this.close();
      return;
    }
    if (code === 1000 && reason === "completed") {
      this.handleEvent(socket, {
        type: "completed",
        sessionId: this.sessionId!,
      });
      return;
    }
    void this.reattach("socket_closed", reason || `WebSocket closed (${code})`);
  }

  private handleEvent(socket: SocketPort, event: ServerEvent) {
    if (socket !== this.socket) return;
    this.lastInboundAt = Date.now();
    const terminalError =
      event.type === "error" && (isTerminalError(event) || this.stopping);
    if (event.type === "connected") {
      logTranscription("reconnect", {
        step: "result",
        ok: true,
        reason: this.reconnectReason,
        epoch: event.epoch,
        durableThroughSeq: event.durableThroughSeq,
      });
      this.attached = true;
      this.attachedAt = Date.now();
      this.disconnectedSince = null;
      this.resendBuffer.ackThrough(event.durableThroughSeq);
      const catchUp = this.resendBuffer.rewind();
      this.congestionCatchUp = null;
      if (this.reconnectReason !== "initial") {
        logTranscription("live", {
          cause: "reattach",
          reason: this.reconnectReason,
          ...catchUp,
        });
      }
      this.uploadBaselineBytes =
        this.resendBuffer.unsentBytes > 0
          ? this.resendBuffer.unsentBytes
          : null;
    }
    if (event.type === "ack") {
      this.lastAckAt = Date.now();
      this.resendBuffer.ackThrough(event.throughChunkSeq);
      this.reportBuffer();
    }
    if (event.type === "completed" || terminalError) {
      this.terminalEventReceived = true;
      this.terminalResolve?.(
        event.type === "completed" ? "completed" : "failed"
      );
    }
    this.options.onEvent(event);

    switch (event.type) {
      case "connected":
        this.updateNotice();
        this.flushPending();
        return;
      case "completed":
        void this.close();
        return;
      case "superseded":
        void this.close();
        return;
      case "reattach":
        void this.reattach(
          reattachCause(event.reason),
          `server reattach: ${event.reason}`,
          event.delayMs
        );
        return;
      case "error":
        if (terminalError) {
          if (this.stopping) void this.close();
          else this.fail(event.message);
        } else if (this.attached && !this.reattaching) {
          void this.reattach("server_reattach", event.message);
        }
        return;
    }
  }

  private reattach(
    cause: ReconnectReason,
    detail: string,
    firstDelayMs = REATTACH_FIRST_DELAY_MS
  ) {
    if (this.closing || this.failed || this.reattaching)
      return this.reattaching;
    // stop 을 기다리던 중이면 다시 붙은 뒤 stop 을 다시 보낸다
    this.terminalResolve?.("reattach");
    this.terminalResolve = null;
    // 붙자마자 끊기기를 되풀이하면 한 번 붙을 때마다 0.5초마다 두드린다
    const churned =
      this.attached && Date.now() - this.attachedAt < STABLE_ATTACH_MS;
    this.churn = churned ? this.churn + 1 : 0;
    if (this.churn > 1) {
      firstDelayMs = Math.max(firstDelayMs, reattachDelayMs(this.churn - 1));
    }
    this.dropSocket(this.socket);
    this.disconnectedSince ??= Date.now();
    this.disconnectDetail = detail;
    this.reconnectReason = cause;
    this.reattaching = this.reattachLoop(firstDelayMs);
    return this.reattaching;
  }

  /** 창은 펌프가 잰다. 여기서는 창이 닫히거나(close) 붙을 때까지 두드린다. */
  private async reattachLoop(firstDelayMs: number) {
    for (let attempt = 0; ; attempt += 1) {
      const delayMs = attempt === 0 ? firstDelayMs : reattachDelayMs(attempt);
      logTranscription("reconnect", {
        step: "wait",
        reason: this.reconnectReason,
        attempt: attempt + 1,
        delayMs: Math.round(delayMs),
      });
      await this.waitForRetry(delayMs);
      if (this.closing || this.failed) break;
      try {
        await this.attach();
        break;
      } catch {
        // 재시도해도 같은 오류였다면 handleEvent 가 이미 실패로 끝냈다
        if (this.closing || this.failed) break;
      }
    }
    this.reattaching = null;
  }

  private waitForRetry(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.wakeRetry = () => {
        clearTimeout(timer);
        resolve();
      };
    }).finally(() => {
      this.wakeRetry = null;
    });
  }

  /** 알아챈 뒤 30초가 지났으면 녹음을 멈춘다. 멈췄으면 true. */
  private checkWindow() {
    if (this.disconnectedSince === null || this.closing || this.failed)
      return false;
    const disconnectedMs = Date.now() - this.disconnectedSince;
    if (disconnectedMs < RESUME_WINDOW_MS) return false;
    const droppedMs = Math.round(this.resendBuffer.bytes / BYTES_PER_MS);
    logTranscription("reconnect", {
      step: "give_up",
      reason: this.reconnectReason,
      disconnectedMs,
      droppedMs,
    });
    logTranscription("notice", { state: "shown", cause: "stopped" });
    // 창 밖의 소리는 보낼 세션이 없다. 버려야 탭 닫기 붙잡기도 풀린다
    this.resendBuffer.ackThrough(Number.MAX_SAFE_INTEGER);
    this.reportBuffer();
    this.fail(`30초 동안 다시 잇지 못했습니다 (${this.disconnectDetail})`, {
      droppedMs,
    });
    return true;
  }

  private updateNotice() {
    const now = Date.now();
    let next: ConnectionNotice | null = null;
    if (!this.closing && this.disconnectedSince !== null) {
      // 영수증 노랑이 이미 떠 있으면 끊지 않고 이어 간다
      if (
        this.offline ||
        this.notice !== null ||
        now - this.disconnectedSince >= NOTICE_AFTER_MS
      ) {
        next = { cause: "disconnected", sinceMs: this.disconnectedSince };
      }
    } else if (
      !this.closing &&
      !this.stopping &&
      this.attached &&
      this.resendBuffer.bytes > 0
    ) {
      const receiptAt = Math.max(this.lastAckAt, this.attachedAt);
      if (now - receiptAt >= RECEIPT_LIMIT_MS) {
        next = { cause: "no_receipt", sinceMs: receiptAt };
      }
    }
    const previous = this.notice;
    if (
      previous?.cause === next?.cause &&
      previous?.sinceMs === next?.sinceMs
    ) {
      return;
    }
    if (previous?.cause === "no_receipt") {
      logTranscription("ack", {
        state: "resumed",
        lateMs: now - previous.sinceMs,
      });
    }
    if (next?.cause === "no_receipt") {
      logTranscription("ack", { state: "late", sinceMs: next.sinceMs });
    }
    logTranscription(
      "notice",
      next
        ? { state: "shown", cause: next.cause, sinceMs: next.sinceMs }
        : { state: "cleared", cause: previous?.cause }
    );
    this.notice = next;
    this.options.onNoticeChange?.(next);
  }

  private checkSilence() {
    if (!this.attached || this.reattaching || this.stopping) return;
    if (Date.now() - this.lastInboundAt >= SILENCE_LIMIT_MS) {
      void this.reattach("no_receive", "no inbound frame for 20s");
    }
  }

  private enqueueAudio(chunk: ArrayBuffer, captureSamples: number) {
    if (this.closing) return;
    const now = Date.now();
    const endMs = (captureSamples + chunk.byteLength / 2) / SAMPLES_PER_MS;
    this.captureStartedAt ??= now - endMs;
    this.capturedMs = endMs;
    // 한도에서는 번호를 쓰지 않고 흘려보낸다. 멈춘 구간은 다음 조각의 captureSamples 건너뜀으로 남는다
    const accepted = this.resendBuffer.push({
      chunkSeq: this.nextChunkSeq,
      captureSamples,
      body: chunk,
    });
    if (accepted) this.nextChunkSeq += 1;
    this.flushPending();
    this.reportBuffer();
  }

  private reportBuffer() {
    const buffer = this.resendBuffer;
    const unsent = buffer.unsentBytes;
    if (unsent === 0) this.uploadBaselineBytes = null;
    const baseline = this.uploadBaselineBytes;
    const state: BufferState = {
      pendingMs: Math.round(buffer.bytes / BYTES_PER_MS),
      limitMs: Math.round(buffer.limitBytes / BYTES_PER_MS),
      paused: buffer.paused,
      upload:
        baseline === null
          ? null
          : {
              percent: Math.max(
                0,
                Math.floor(((baseline - unsent) * 100) / baseline)
              ),
              remainingMs: Math.round(unsent / BYTES_PER_MS),
            },
    };
    // 조각마다(100ms) 그리지 않는다. 화면이 쓰는 단위(초·퍼센트)가 바뀔 때만 알린다
    const key = [
      state.pendingMs > 0,
      Math.floor(state.pendingMs / 1000),
      state.limitMs,
      state.paused,
      state.upload?.percent,
      state.upload && Math.floor(state.upload.remainingMs / 1000),
    ].join();
    if (key === this.lastBufferKey) return;
    this.lastBufferKey = key;
    this.options.onBufferChange?.(state);
  }

  private captureGapMs(now: number) {
    if (this.captureStartedAt === null) return 0;
    return Math.max(
      0,
      Math.round(now - this.captureStartedAt - this.capturedMs)
    );
  }

  /**
   * 아직 못 건넨 조각을 민다. 실시간이 먼저, 밀린 것은 소켓이 받아 주는 만큼.
   * 소켓이 거절하면 그 자리에서 멈춘다 — 각 줄 안에서 건너뛰면 서버가 유실로 읽는다.
   */
  private flushPending() {
    if (!this.socket || !this.attached) return;
    const catchUp = this.resendBuffer.catchUp();
    if (catchUp.lateChunks > 0) {
      this.congestionCatchUp = {
        lateChunks:
          (this.congestionCatchUp?.lateChunks ?? 0) + catchUp.lateChunks,
        liveLagMs: catchUp.liveLagMs,
      };
    }
    let sentAny = false;
    let refused = false;
    for (
      let chunk = this.resendBuffer.next();
      chunk;
      chunk = this.resendBuffer.next()
    ) {
      if (
        !this.socket.sendAudio(chunk.body, chunk.chunkSeq, chunk.captureSamples)
      ) {
        refused = true;
        break;
      }
      this.resendBuffer.markSent();
      sentAny = true;
    }
    if (sentAny) this.reportBuffer();

    if (!refused) {
      this.congestedSinceMs = null;
      if (this.congestionCatchUp) {
        logTranscription("live", {
          cause: "congestion",
          ...this.congestionCatchUp,
        });
        this.congestionCatchUp = null;
      }
      return;
    }
    const now = Date.now();
    // 조금이라도 나갔으면 회선이 살아 있는 것이다. 시계를 다시 잡는다.
    if (this.congestedSinceMs === null || sentAny) {
      this.congestedSinceMs = now;
      return;
    }
    if (now - this.congestedSinceMs >= MAX_CONGESTION_MS) {
      void this.reattach("send_stalled", "send congestion");
    }
  }

  private fail(message: string, detail?: { droppedMs: number }) {
    if (this.failed || this.closing) return;
    this.failed = true;
    this.terminalResolve?.("failed");
    if (detail) this.options.onFailure(message, detail);
    else this.options.onFailure(message);
    void this.close();
  }

  private stopAudio() {
    if (this.audioStopped) return Promise.resolve();
    this.audioStopped = true;
    return this.audio.stop();
  }

  private async rejectIfStopped() {
    if (!this.stopping && !this.closing) return;
    const socket = this.socket;
    await this.close();
    await Promise.allSettled([
      this.audio.stop(),
      socket?.close() ?? Promise.resolve(),
    ]);
    throw new Error("REALTIME_SESSION_CLOSED");
  }
}
