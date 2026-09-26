import {
  PcmAudioCapture,
  type MicrophoneState,
} from "@/lib/transcription/audio";
import {
  CAPTURE_CONTRACT,
  CAPTURE_TUNING,
} from "@/lib/transcription/capture-config";
import {
  openAudioStore,
  type AudioStore,
  type StoredChunk,
} from "@/lib/transcription/audio-store";
import {
  isTerminalError,
  type ServerEvent,
} from "@/lib/transcription/protocol";
import { ResendBuffer } from "@/lib/transcription/resend-buffer";
import {
  TranscriptionSocket,
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
  /** 지난 탭이 디스크에 남긴 조각을 그 세션에 올리고 멈춘다. 마이크는 켜지 않는다. */
  resume?: (sessionId: string, chunks: StoredChunk[]) => Promise<void>;
};

/** 다시 잇는 중. `pendingMs` 는 끊긴 순간 서버가 아직 확정 안 한 소리의 길이다. */
export type ReconnectState = { sinceMs: number; pendingMs: number };

/**
 * 서버가 확정 안 한 소리가 이 기기에 얼마나 있나.
 * - `persistent`: 디스크(IndexedDB)에 담기고 있다. 아니면 `limitMs` 가 메모리 한도(5분)로 줄어든다.
 * - `paused`: 한도에 닿아 캡처한 소리를 받지 않는 중이다. 밀린 것이 빠지면 저절로 풀린다.
 * - `upload`: 다시 붙은 뒤나 멈춘 뒤 밀린 소리를 올리는 중. 다 보내면 null.
 */
export type BufferState = {
  pendingMs: number;
  limitMs: number;
  persistent: boolean;
  paused: boolean;
  upload: { percent: number; remainingMs: number } | null;
};

export type RealtimeSessionOptions = {
  url: string;
  onEvent: (event: ServerEvent) => void;
  onLevel: (level: number) => void;
  onFailure: (message: string) => void;
  onReconnectChange?: (state: ReconnectState | null) => void;
  onBufferChange?: (state: BufferState) => void;
  /** 디스크에 담을 때 붙이는 이름표. 다음 방문 때 어느 노트의 소리인지 안다. */
  noteId?: string;
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
  /** 없으면 IndexedDB. null 이면 메모리만 쓴다. */
  createStore?: () => AudioStore | null;
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
/** 서버가 부착 없이 세션을 버티는 재개 창과 같다. */
const REATTACH_WINDOW_MS = 300_000;
/** 이보다 짧게 살고 끊긴 부착이 이어지면 연결은 되는데 못 버티는 것이다. 다시 붙는 간격을 늘려 간다. */
const STABLE_ATTACH_MS = 10_000;
/** 멈춘 뒤 붙어 있는데도 밀린 소리가 이만큼 한 조각도 안 나가면(디스크를 못 읽음) 기다리지 않는다. */
const STOP_STALL_MS = 30_000;
const BYTES_PER_MS =
  (CAPTURE_CONTRACT.sampleRate * CAPTURE_CONTRACT.bytesPerSample) / 1000;
const MEMORY_LIMIT_BYTES = CAPTURE_TUNING.memoryBufferMs * BYTES_PER_MS;
const DISK_LIMIT_BYTES = CAPTURE_TUNING.diskBufferMs * BYTES_PER_MS;
const SAMPLES_PER_MS = CAPTURE_CONTRACT.sampleRate / 1000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

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
 * sessionStorage 는 새로고침을 넘어 남는다. 새로고침한 탭이 남긴 소리를 올리러 붙을 때
 * 옛 리스(15s)가 살아 있어도 같은 탭으로 보여야 거절당하지 않는다.
 */
function clientInstanceId() {
  if (tabInstanceId) return tabInstanceId;
  try {
    tabInstanceId = sessionStorage.getItem(TAB_INSTANCE_KEY);
  } catch {
    // Node 실험 틀·저장소가 막힌 창
  }
  tabInstanceId ??= crypto.randomUUID();
  try {
    sessionStorage.setItem(TAB_INSTANCE_KEY, tabInstanceId);
  } catch {
    // 위와 같다
  }
  return tabInstanceId;
}

/**
 * 녹음 한 번 = 세션 하나. 소켓은 그 세션에 붙는 부착이라 끊기면 **같은 세션에** 다시 붙고,
 * 서버가 확정한 조각 다음부터 버퍼에서 다시 보낸다. `chunkSeq` 는 녹음 내내 이어진다.
 *
 * 녹음이 실패로 끝나는 길: 재시도해도 같은 in-band 오류, 재개 창(300s) 소진, 종료 응답 시간 초과.
 * 버퍼 한도(디스크 60분, 못 쓰면 메모리 5분)는 실패가 아니다. 캡처를 멈췄다가 빠지면 다시 받는다.
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
  private lastInboundAt = 0;
  private pumpTimer: ReturnType<typeof setInterval> | null = null;
  private nextChunkSeq = 0;
  private captureStartedAt: number | null = null;
  private capturedMs = 0;
  private resendBuffer!: ResendBuffer;
  /** 올리기 진행률의 분모. 다시 붙거나 멈출 때 남은 양으로 잡는다. */
  private uploadBaselineBytes: number | null = null;
  private lastBufferKey = "";

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
    this.open(sessionId);
    await this.attach();
    await this.rejectIfStopped();
    await this.audio.start();
    await this.rejectIfStopped();
    this.startPump();
  }

  async resume(sessionId: string, chunks: StoredChunk[]) {
    if (this.sessionId) throw new Error("REALTIME_SESSION_ALREADY_CONNECTED");
    this.open(sessionId);
    this.audioStopped = true;
    this.resendBuffer.restore(chunks);
    this.nextChunkSeq = chunks[chunks.length - 1].chunkSeq + 1;
    try {
      await this.attach();
    } catch (error) {
      await this.close();
      throw error;
    }
    this.startPump();
    await this.stop();
  }

  private open(sessionId: string) {
    this.sessionId = sessionId;
    this.resendBuffer = new ResendBuffer({
      memoryLimitBytes: MEMORY_LIMIT_BYTES,
      diskLimitBytes: DISK_LIMIT_BYTES,
      store: (this.dependencies.createStore ?? openAudioStore)(),
      noteId: this.options.noteId ?? "",
      sessionId,
      onChange: () => {
        this.flushPending();
        this.reportBuffer();
      },
    });
  }

  private startPump() {
    this.pumpTimer = setInterval(() => {
      this.flushPending();
      this.checkSilence();
    }, PUMP_MS);
  }

  stop() {
    this.stopping = true;
    this.stopPromise ??= this.stopOnce();
    return this.stopPromise;
  }

  /**
   * 서버는 `finalChunkSeq` 까지 저장한 뒤에만 completed 를 보낸다. 못 끝냈거나 stop 을 보낸 부착이 끊기면 다시 붙어
   * 이어 보내고 stop 을 다시 보낸다. 그렇게 5분을 넘기면 멈추고 알린다 — 남은 소리는 이 기기에 둔다.
   */
  private async stopOnce() {
    if (this.closing) return this.closePromise ?? Promise.resolve();
    // Browser audio cleanup can reject after the final PCM batch was flushed
    // (for example when AudioContext was already closed). The server stop must
    // still be sent so an ACTIVE session is not left behind.
    await this.stopAudio().catch(() => undefined);
    const since = Date.now();
    for (;;) {
      // 다시 잇는 중이면 이은 뒤에 남은 소리를 보내고 멈춘다
      if (this.reattaching) await this.reattaching;
      if (!this.socket || !this.attached) {
        await this.close();
        return;
      }
      // 회의 끝이 올리기 끝이 아니다. 밀린 것을 다 건넨 뒤에 stop 을 보낸다
      if (!(await this.sendAllForStop())) {
        this.fail(
          "이 기기에 담아 둔 소리를 읽지 못해 다 올리지 못했습니다. 이 기기에 남겨 둡니다."
        );
        return;
      }
      const socket = this.socket;
      if (this.closing || !socket || !this.attached) {
        await this.close();
        return;
      }
      const state = await this.sendStop(socket);
      if (state === "reattach") {
        if (Date.now() - since < REATTACH_WINDOW_MS) continue;
        this.fail(
          "5분 동안 저장을 마치지 못했습니다. 남은 소리는 이 기기에 남겨 둡니다."
        );
        return;
      }
      if (state === "timeout") {
        this.fail("스크립트 완료 응답을 기다리는 중 시간이 초과되었습니다.");
      }
      await this.close();
      return;
    }
  }

  /** 다 건넸으면 true. 붙어 있는데도 [STOP_STALL_MS] 동안 하나도 못 건넸으면 false. */
  private async sendAllForStop() {
    let unsent = this.resendBuffer.unsentBytes;
    if (unsent > 0) {
      this.uploadBaselineBytes ??= unsent;
      this.reportBuffer();
    }
    let movedAt = Date.now();
    while (this.resendBuffer.unsentBytes > 0) {
      if (this.closing || this.failed) return true;
      await sleep(PUMP_MS);
      if (
        this.resendBuffer.unsentBytes !== unsent ||
        !this.attached ||
        this.reattaching
      ) {
        unsent = this.resendBuffer.unsentBytes;
        movedAt = Date.now();
      } else if (Date.now() - movedAt >= STOP_STALL_MS) {
        return false;
      }
    }
    return true;
  }

  private async sendStop(socket: SocketPort): Promise<TerminalState> {
    const terminal = new Promise<Exclude<TerminalState, "timeout">>(
      (resolve) => {
        this.terminalResolve = resolve;
      }
    );
    try {
      this.flushPending();
      socket.stop(this.nextChunkSeq - 1);
    } catch {
      this.terminalResolve = null;
      this.fail("스크립트 종료 요청을 서버에 보내지 못했습니다.");
      return "failed";
    }
    let timeoutId: ReturnType<typeof globalThis.setTimeout>;
    const timeout = new Promise<"timeout">((resolve) => {
      timeoutId = globalThis.setTimeout(() => resolve("timeout"), 11_000);
    });
    const state = await Promise.race<TerminalState>([terminal, timeout]);
    globalThis.clearTimeout(timeoutId!);
    this.terminalResolve = null;
    return state;
  }

  reconcile(status: RealtimeSessionStatus) {
    if (status === "ACTIVE") {
      this.socket?.reconcileConnected();
      return;
    }
    this.terminalResolve?.(status === "COMPLETED" ? "completed" : "failed");
    void this.close();
  }

  close() {
    if (this.closing) return this.closePromise ?? Promise.resolve();
    this.closing = true;
    if (this.pumpTimer) clearInterval(this.pumpTimer);
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
    const socket: SocketPort = createSocket({
      url: this.options.url,
      sessionId: this.sessionId!,
      clientInstanceId: clientInstanceId(),
      resendFromSeq: this.resendBuffer.firstSeq ?? this.nextChunkSeq,
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
    void this.reattach(reason || `WebSocket closed (${code})`);
  }

  private handleEvent(socket: SocketPort, event: ServerEvent) {
    if (socket !== this.socket) return;
    this.lastInboundAt = Date.now();
    const terminalError =
      event.type === "error" && (isTerminalError(event) || this.stopping);
    if (event.type === "connected") {
      this.attached = true;
      this.attachedAt = Date.now();
      this.resendBuffer.ackThrough(event.durableThroughSeq);
      this.resendBuffer.rewind();
      this.uploadBaselineBytes =
        this.resendBuffer.unsentBytes > 0
          ? this.resendBuffer.unsentBytes
          : null;
    }
    if (event.type === "ack") {
      this.resendBuffer.ackThrough(event.throughChunkSeq);
      this.reportBuffer();
    }
    // 서버가 틀려도 마지막 사본은 남긴다. ACK 못 받은 것은 다음 방문 때 이어 올리기 대상이다
    if (event.type === "completed" && this.resendBuffer.bytes === 0) {
      this.resendBuffer.forget();
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
        this.flushPending();
        return;
      case "completed":
        void this.close();
        return;
      case "superseded":
        void this.close();
        return;
      case "reattach":
        void this.reattach(`server reattach: ${event.reason}`, event.delayMs);
        return;
      case "error":
        if (terminalError) {
          if (this.stopping) void this.close();
          else this.fail(event.message);
        } else if (this.attached && !this.reattaching) {
          void this.reattach(event.message);
        }
        return;
    }
  }

  private reattach(reason: string, firstDelayMs = REATTACH_FIRST_DELAY_MS) {
    if (this.closing || this.failed || this.reattaching)
      return this.reattaching;
    // stop 을 기다리던 중이면 다시 붙은 뒤 stop 을 다시 보낸다
    this.terminalResolve?.("reattach");
    this.terminalResolve = null;
    // 붙자마자 끊기기를 되풀이하면 한 번 붙을 때마다 창과 횟수가 새로 시작돼 0.5초마다 두드린다
    const churned =
      this.attached && Date.now() - this.attachedAt < STABLE_ATTACH_MS;
    this.churn = churned ? this.churn + 1 : 0;
    if (this.churn > 1) {
      firstDelayMs = Math.max(firstDelayMs, reattachDelayMs(this.churn - 1));
    }
    this.dropSocket(this.socket);
    const sinceMs = Date.now();
    this.options.onReconnectChange?.({
      sinceMs,
      pendingMs: Math.round(this.resendBuffer.bytes / BYTES_PER_MS),
    });
    this.reattaching = this.reattachWithinWindow(reason, sinceMs, firstDelayMs);
    return this.reattaching;
  }

  private async reattachWithinWindow(
    reason: string,
    sinceMs: number,
    firstDelayMs: number
  ) {
    const deadline = sinceMs + REATTACH_WINDOW_MS;
    for (let attempt = 0; ; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        this.reattaching = null;
        this.fail(`5분 동안 다시 잇지 못했습니다 (${reason})`);
        return;
      }
      const delay = attempt === 0 ? firstDelayMs : reattachDelayMs(attempt);
      await sleep(Math.min(delay, remaining));
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
    if (!this.closing && !this.failed) this.options.onReconnectChange?.(null);
  }

  private checkSilence() {
    if (!this.attached || this.reattaching || this.stopping) return;
    if (Date.now() - this.lastInboundAt >= SILENCE_LIMIT_MS) {
      void this.reattach("no inbound frame for 20s");
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
      persistent: buffer.persistent,
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
      state.persistent,
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

    // 디스크에서 읽는 중인 것은 회선 탓이 아니다
    if (!refused) {
      this.congestedSinceMs = null;
      return;
    }
    const now = Date.now();
    // 조금이라도 나갔으면 회선이 살아 있는 것이다. 시계를 다시 잡는다.
    if (this.congestedSinceMs === null || sentAny) {
      this.congestedSinceMs = now;
      return;
    }
    if (now - this.congestedSinceMs >= MAX_CONGESTION_MS) {
      void this.reattach("send congestion");
    }
  }

  private fail(message: string) {
    if (this.failed || this.closing) return;
    this.failed = true;
    this.terminalResolve?.("failed");
    this.options.onFailure(message);
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
