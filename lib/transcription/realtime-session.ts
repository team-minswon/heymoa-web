import { PcmAudioCapture } from "@/lib/transcription/audio";
import { CAPTURE_TUNING } from "@/lib/transcription/capture-config";
import type { ServerEvent } from "@/lib/transcription/protocol";
import { ResendBuffer } from "@/lib/transcription/resend-buffer";
import { TranscriptionSocket } from "@/lib/transcription/socket";

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

export type RealtimeSessionOptions = {
  url: string;
  onEvent: (event: ServerEvent) => void;
  onLevel: (level: number) => void;
  onFailure: (message: string) => void;
};

export type RealtimeSessionDependencies = {
  createAudio?: (
    onChunk: (chunk: ArrayBuffer, captureSamples: number) => void,
    onLevel: (level: number) => void
  ) => AudioPort;
  createSocket?: (options: {
    url: string;
    sessionId: string;
    onEvent: (event: ServerEvent) => void;
    onClose: (code: number, reason: string) => void;
  }) => SocketPort;
};

type TerminalState = "completed" | "failed" | "timeout";

// 소켓이 이 시간만큼 연속으로 조각을 안 받으면 회복 불가로 판정한다. 백프레셔 임계(96KB)가
// PCM 3초분이라 일시적 지연은 살아남고, 이 시간 내내 밀린 채였다면 회선이 사실상 죽은 것이다.
const MAX_CONGESTION_MS = CAPTURE_TUNING.congestionMs;

export class BrowserRealtimeSession implements RealtimeSessionController {
  private readonly audio: AudioPort;
  private socket: SocketPort | null = null;
  private stopPromise: Promise<void> | null = null;
  private closePromise: Promise<void> | null = null;
  private stopping = false;
  private closing = false;
  private audioStopped = false;
  private terminalEventReceived = false;
  private terminalResolve:
    | ((state: Exclude<TerminalState, "timeout">) => void)
    | null = null;
  private failed = false;
  private congestedSinceMs: number | null = null;
  /** 세션 안에서 0부터 1씩. 워크릿도 배처도 세션 경계를 모르므로 여기가 발급한다. */
  private nextChunkSeq = 0;
  private readonly resendBuffer = new ResendBuffer(
    CAPTURE_TUNING.resendBufferMaxBytes
  );

  constructor(
    private readonly options: RealtimeSessionOptions,
    private readonly dependencies: RealtimeSessionDependencies = {}
  ) {
    const createAudio =
      dependencies.createAudio ??
      ((onChunk, onLevel) => new PcmAudioCapture({ onChunk, onLevel }));
    this.audio = createAudio(
      (chunk, captureSamples) => this.enqueueAudio(chunk, captureSamples),
      options.onLevel
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
    if (this.socket) throw new Error("REALTIME_SESSION_ALREADY_CONNECTED");
    const createSocket =
      this.dependencies.createSocket ??
      ((socketOptions) => new TranscriptionSocket(socketOptions));
    const socket = createSocket({
      url: this.options.url,
      sessionId,
      onEvent: (event) => this.handleEvent(event),
      onClose: (code, reason) => {
        if (this.terminalEventReceived) {
          void this.close();
          return;
        }
        if (code === 1000 && reason === "completed") {
          this.handleEvent({ type: "completed", sessionId });
          void this.close();
          return;
        }
        this.fail(reason || `WebSocket closed (${code})`);
      },
    });
    this.socket = socket;
    await socket.connect();
    await this.rejectIfStopped(socket);
    if (this.failed) return;
    await this.audio.start();
    await this.rejectIfStopped(socket);
  }

  stop() {
    this.stopping = true;
    this.stopPromise ??= this.stopOnce();
    return this.stopPromise;
  }

  private async stopOnce() {
    if (this.closing) return this.closePromise ?? Promise.resolve();
    // Browser audio cleanup can reject after the final PCM batch was flushed
    // (for example when AudioContext was already closed). The server stop must
    // still be sent so an ACTIVE session is not left behind.
    await this.stopAudio().catch(() => undefined);
    const socket = this.socket;
    if (!socket) {
      await this.close();
      return;
    }

    const terminal = new Promise<Exclude<TerminalState, "timeout">>(
      (resolve) => {
        this.terminalResolve = resolve;
      }
    );
    try {
      // 남은 것을 마지막으로 한 번 더 밀어 본다. 그다음 「내가 여기까지 보냈다」를 말한다.
      this.flushPending();
      socket.stop(this.nextChunkSeq - 1);
    } catch {
      this.fail("전사 종료 요청을 서버에 보내지 못했습니다.");
      await this.close();
      return;
    }
    let timeoutId: ReturnType<typeof globalThis.setTimeout>;
    const timeout = new Promise<"timeout">((resolve) => {
      timeoutId = globalThis.setTimeout(() => resolve("timeout"), 11_000);
    });
    const state = await Promise.race<TerminalState>([terminal, timeout]);
    globalThis.clearTimeout(timeoutId!);
    this.terminalResolve = null;
    if (state === "timeout") {
      this.fail("전사 완료 응답을 기다리는 중 시간이 초과되었습니다.");
    }
    await this.close();
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
    this.terminalResolve?.("failed");
    this.terminalResolve = null;
    const socket = this.socket;
    this.socket = null;
    this.closePromise = Promise.allSettled([
      this.stopAudio(),
      socket?.close() ?? Promise.resolve(),
    ]).then(() => undefined);
    return this.closePromise;
  }

  private enqueueAudio(chunk: ArrayBuffer, captureSamples: number) {
    if (this.closing) return;
    this.resendBuffer.push({
      chunkSeq: this.nextChunkSeq,
      captureSamples,
      body: chunk,
    });
    this.nextChunkSeq += 1;
    this.flushPending();
  }

  /**
   * 아직 못 건넨 조각을 순서대로 민다. 소켓이 거절하면 그 자리에서 멈춘다 —
   * 건너뛰면 `chunkSeq`에 구멍이 나서 서버가 유실로 읽는다.
   *
   * 예전에는 거절된 frame을 그냥 버렸다. 이제는 버퍼에 남아 다음에 다시 시도되고,
   * 정말 회복 못 하면 상한(10 MB)에서 오래된 것부터 밀려난다.
   */
  private flushPending() {
    if (!this.socket) return;
    let sentAny = false;
    for (const chunk of this.resendBuffer.unsent()) {
      if (
        !this.socket.sendAudio(chunk.body, chunk.chunkSeq, chunk.captureSamples)
      ) {
        break;
      }
      this.resendBuffer.markSent();
      sentAny = true;
    }

    const stalled = this.resendBuffer.unsent().length > 0;
    if (!stalled) {
      if (this.congestedSinceMs !== null) {
        console.warn(
          `transcription: 전송 정체 회복, ${Date.now() - this.congestedSinceMs}ms 밀렸습니다`
        );
        this.congestedSinceMs = null;
      }
      return;
    }

    const now = Date.now();
    if (this.congestedSinceMs === null) {
      this.congestedSinceMs = now;
      console.warn("transcription: 전송 정체 시작, 조각을 버퍼에 쌓습니다");
      return;
    }
    // 조금이라도 나갔으면 회선이 살아 있는 것이다. 시계를 다시 잡는다.
    if (sentAny) {
      this.congestedSinceMs = now;
      return;
    }
    if (now - this.congestedSinceMs >= MAX_CONGESTION_MS) {
      this.fail("네트워크가 느려 오디오 전송을 계속할 수 없습니다.");
    }
  }

  private handleEvent(event: ServerEvent) {
    if (event.type === "ack") {
      this.resendBuffer.ackThrough(event.throughChunkSeq);
    }
    if (event.type === "completed") {
      this.terminalEventReceived = true;
      this.terminalResolve?.("completed");
    }
    if (event.type === "error") {
      this.terminalEventReceived = true;
      this.terminalResolve?.("failed");
    }
    this.options.onEvent(event);
    if (event.type === "error") void this.close();
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

  private async rejectIfStopped(socket: SocketPort | null = this.socket) {
    if (!this.stopping && !this.closing) return;
    await this.close();
    await Promise.allSettled([
      this.audio.stop(),
      socket?.close() ?? Promise.resolve(),
    ]);
    throw new Error("REALTIME_SESSION_CLOSED");
  }
}
