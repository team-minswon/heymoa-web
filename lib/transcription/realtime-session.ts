import { SessionExpiredError } from "@/lib/auth/session-gate";
import {
  PcmAudioCapture,
  type MicrophoneState,
} from "@/lib/transcription/audio";
import {
  CAPTURE_CONTRACT,
  CAPTURE_TUNING,
} from "@/lib/transcription/capture-config";
import { logTranscription } from "@/lib/transcription/log";
import { clientInstanceId } from "@/lib/transcription/recorder-lease";
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

export type ConnectionNotice = {
  cause: "disconnected" | "no_receipt";
  sinceMs: number;
};

export type BufferState = {
  pendingMs: number;
  limitMs: number;
  paused: boolean;
  upload: { percent: number; remainingMs: number } | null;
};

export type RealtimeFailureKind =
  | "resume_window_exhausted"
  | "stop_timeout"
  | "stop_send_failed"
  | "server_error";

export type RealtimeFailureDetail = {
  droppedMs: number;
  reason?: string;
};

export type RealtimeSessionOptions = {
  url: string;
  onEvent: (event: ServerEvent) => void;
  onLevel: (level: number) => void;
  onFailure: (kind: RealtimeFailureKind, detail: RealtimeFailureDetail) => void;
  onNoticeChange?: (notice: ConnectionNotice | null) => void;
  onBufferChange?: (state: BufferState) => void;
  onMicrophoneChange?: (state: MicrophoneState, captureGapMs: number) => void;
  onSystemAudioChange?: (state: MicrophoneState | null) => void;
  onCaptureError?: (code: string) => void;
};

export type RealtimeSessionDependencies = {
  createAudio?: (
    onChunk: (chunk: ArrayBuffer, captureSamples: number) => void,
    onLevel: (level: number) => void,
    onState: (state: MicrophoneState) => void
  ) => AudioPort;
  createSocket?: (options: TranscriptionSocketOptions) => SocketPort;
};

type TerminalState = "completed" | "failed" | "timeout" | "reattach";

const MAX_CONGESTION_MS = CAPTURE_TUNING.congestionMs;
const SILENCE_LIMIT_MS = 20_000;
const PUMP_MS = 100;
const REATTACH_FIRST_DELAY_MS = 500;
const REATTACH_MIN_DELAY_MS = 500;
const REATTACH_MAX_DELAY_MS = 5_000;
const RESUME_WINDOW_MS = 30_000;
const NOTICE_AFTER_MS = 5_000;
const RECEIPT_LIMIT_MS = 10_000;
const STOP_TIMEOUT_MS = 45_000;
const STOP_TOTAL_MS = 60_000;
const STABLE_ATTACH_MS = 10_000;
const TRAILING_LIMIT_MS = 30_000;
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

function firstReattachDelayMs() {
  return REATTACH_FIRST_DELAY_MS * (0.5 + Math.random());
}

function reattachDelayMs(attempt: number) {
  const ceiling = Math.min(
    REATTACH_MAX_DELAY_MS,
    REATTACH_MIN_DELAY_MS * 2 ** attempt
  );
  return (
    REATTACH_MIN_DELAY_MS + Math.random() * (ceiling - REATTACH_MIN_DELAY_MS)
  );
}

export class BrowserRealtimeSession implements RealtimeSessionController {
  private readonly audio: AudioPort;
  private sessionId: string | null = null;
  private socket: SocketPort | null = null;
  private trailing: SocketPort | null = null;
  private trailingTimer: ReturnType<typeof setTimeout> | null = null;
  private attached = false;
  private reattaching: Promise<void> | null = null;
  private bounce: ((delayMs: number) => void) | null = null;
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
  private churn = 0;
  private failed = false;
  private congestedSinceMs: number | null = null;
  private congestionCatchUp: CatchUp | null = null;
  private lastInboundAt = 0;
  private pumpTimer: ReturnType<typeof setInterval> | null = null;
  private nextChunkSeq = 0;
  private captureStartedAt: number | null = null;
  private capturedMs = 0;
  private resendBuffer!: ResendBuffer;
  private uploadBaselineBytes: number | null = null;
  private lastBufferKey = "";
  private disconnectedSince: number | null = null;
  private disconnectDetail = "";
  private reconnectReason: ReconnectReason = "initial";
  private offline = false;
  private lastAckAt = 0;
  private notice: ConnectionNotice | null = null;
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
    try {
      await this.attach();
    } catch (error) {
      if (!this.reattaching && !this.attached) throw error;
    }
    await this.rejectIfStopped();
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

  private async stopOnce() {
    if (this.closing) return this.closePromise ?? Promise.resolve();
    const since = Date.now();
    const deadline = since + STOP_TOTAL_MS;
    const untilDeadline = (work: Promise<unknown>) =>
      Promise.race([work, sleep(Math.max(0, deadline - Date.now()))]);
    // Browser audio cleanup can reject (e.g. AudioContext already closed); stop must still be sent.
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
      if (this.reattaching) await untilDeadline(this.reattaching);
      if (Date.now() >= deadline) break;
      if (!this.socket || !this.attached) return closeUnattached();
      await this.sendAllForStop(deadline);
      if (Date.now() >= deadline) break;
      const socket = this.socket;
      if (this.closing || !socket || !this.attached) return closeUnattached();
      this.dropTrailing();
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

  private failStop() {
    const droppedMs = Math.round(this.resendBuffer.bytes / BYTES_PER_MS);
    this.resendBuffer.ackThrough(Number.MAX_SAFE_INTEGER);
    this.reportBuffer();
    this.fail("stop_timeout", { droppedMs });
  }

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
      this.fail("stop_send_failed", {
        droppedMs: Math.round(this.resendBuffer.bytes / BYTES_PER_MS),
      });
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
    this.dropTrailing();
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

  private dropSocket(socket: SocketPort | null) {
    if (!socket) return;
    if (this.socket === socket) {
      this.socket = null;
      this.attached = false;
    }
    if (socket !== this.trailing) void socket.close().catch(() => undefined);
  }

  private handleClose(socket: SocketPort, code: number, reason: string) {
    if (socket === this.trailing) {
      this.dropTrailing();
      return;
    }
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
    if (socket === this.trailing) {
      if (event.type === "final" || event.type === "partial")
        this.options.onEvent(event);
      return;
    }
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
        if (this.bounce && !this.attached) {
          this.bounce(event.delayMs);
          return;
        }
        if (
          event.overlap &&
          this.attached &&
          !this.reattaching &&
          this.resendBuffer.unsentBytes === 0
        )
          this.keepTrailing(socket);
        void this.reattach(
          reattachCause(event.reason),
          `server reattach: ${event.reason}`,
          event.delayMs
        );
        return;
      case "error":
        if (terminalError) {
          if (this.stopping) void this.close();
          else
            this.fail("server_error", { droppedMs: 0, reason: event.message });
        } else if (this.attached && !this.reattaching) {
          void this.reattach("server_reattach", event.message);
        }
        return;
    }
  }

  private keepTrailing(socket: SocketPort) {
    this.dropTrailing();
    this.trailing = socket;
    this.trailingTimer = setTimeout(
      () => this.dropTrailing(),
      TRAILING_LIMIT_MS
    );
  }

  private dropTrailing() {
    if (this.trailingTimer) clearTimeout(this.trailingTimer);
    this.trailingTimer = null;
    const trailing = this.trailing;
    this.trailing = null;
    void trailing?.close().catch(() => undefined);
  }

  private reattach(
    cause: ReconnectReason,
    detail: string,
    firstDelayMs = firstReattachDelayMs()
  ) {
    if (this.closing || this.failed || this.reattaching)
      return this.reattaching;
    this.terminalResolve?.("reattach");
    this.terminalResolve = null;
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

  private async reattachLoop(firstDelayMs: number) {
    let bouncedDelayMs: number | null = null;
    let bounces = 0;
    for (let attempt = 0; ; attempt += 1) {
      const delayMs =
        attempt === 0
          ? firstDelayMs
          : bouncedDelayMs !== null && bounces === 1
            ? bouncedDelayMs
            : Math.max(bouncedDelayMs ?? 0, reattachDelayMs(attempt));
      bouncedDelayMs = null;
      logTranscription("reconnect", {
        step: "wait",
        reason: this.reconnectReason,
        attempt: attempt + 1,
        delayMs: Math.round(delayMs),
      });
      await this.waitForRetry(delayMs);
      if (this.closing || this.failed) break;
      try {
        bouncedDelayMs = await this.attachUnlessBounced();
        if (bouncedDelayMs === null) break;
        bounces += 1;
      } catch (error) {
        if (this.closing || this.failed) break;
        if (error instanceof SessionExpiredError) {
          logTranscription("reconnect", { step: "session_expired" });
          void this.close();
          break;
        }
      }
    }
    this.reattaching = null;
  }

  /** 돌려보낸 소켓은 닫힘을 기다리지 않습니다. ALB 가 내려가는 태스크로 보낸 것이라 닫힘까지 1~2초가 걸립니다. */
  private attachUnlessBounced() {
    const bounced = new Promise<number>((resolve) => {
      this.bounce = resolve;
    });
    const attaching = this.attach();
    return Promise.race([attaching.then(() => null), bounced])
      .then((delayMs) => {
        if (delayMs !== null) {
          attaching.catch(() => undefined);
          this.dropSocket(this.socket);
        }
        return delayMs;
      })
      .finally(() => {
        this.bounce = null;
      });
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
    this.resendBuffer.ackThrough(Number.MAX_SAFE_INTEGER);
    this.reportBuffer();
    this.fail("resume_window_exhausted", {
      droppedMs,
      reason: this.disconnectDetail,
    });
    return true;
  }

  private updateNotice() {
    const now = Date.now();
    let next: ConnectionNotice | null = null;
    if (!this.closing && this.disconnectedSince !== null) {
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
    const chunkSeq = this.nextChunkSeq;
    const accepted = this.resendBuffer.push({
      chunkSeq,
      captureSamples,
      body: chunk,
    });
    if (accepted) {
      this.nextChunkSeq += 1;
      if (
        this.trailing &&
        !this.trailing.sendAudio(chunk, chunkSeq, captureSamples)
      )
        this.dropTrailing();
    }
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
    if (this.congestedSinceMs === null || sentAny) {
      this.congestedSinceMs = now;
      return;
    }
    if (now - this.congestedSinceMs >= MAX_CONGESTION_MS) {
      void this.reattach("send_stalled", "send congestion");
    }
  }

  private fail(kind: RealtimeFailureKind, detail: RealtimeFailureDetail) {
    if (this.failed || this.closing) return;
    this.failed = true;
    this.terminalResolve?.("failed");
    this.options.onFailure(kind, detail);
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
