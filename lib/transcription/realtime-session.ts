import { PcmAudioCapture } from "@/lib/transcription/audio";
import type { ServerEvent } from "@/lib/transcription/protocol";
import { TranscriptionSocket } from "@/lib/transcription/socket";

type AudioPort = Pick<PcmAudioCapture, "requestPermission" | "start" | "stop">;
type SocketPort = Pick<
  TranscriptionSocket,
  "connect" | "sendAudio" | "commit" | "stop" | "close" | "reconcileConnected"
>;

export type RealtimeSessionStatus = "ACTIVE" | "COMPLETED" | "INTERRUPTED";

export type RealtimeSessionController = {
  requestPermission: () => Promise<void>;
  connect: (sessionId: string) => Promise<void>;
  commit: () => void;
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
    onChunk: (chunk: ArrayBuffer) => void,
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

export class BrowserRealtimeSession implements RealtimeSessionController {
  private readonly audio: AudioPort;
  private socket: SocketPort | null = null;
  private stopPromise: Promise<void> | null = null;
  private closePromise: Promise<void> | null = null;
  private closing = false;
  private audioStopped = false;
  private terminalEventReceived = false;
  private terminalResolve:
    | ((state: Exclude<TerminalState, "timeout">) => void)
    | null = null;
  private failed = false;

  constructor(
    private readonly options: RealtimeSessionOptions,
    private readonly dependencies: RealtimeSessionDependencies = {}
  ) {
    const createAudio =
      dependencies.createAudio ??
      ((onChunk, onLevel) => new PcmAudioCapture({ onChunk, onLevel }));
    this.audio = createAudio((chunk) => this.sendAudio(chunk), options.onLevel);
  }

  requestPermission() {
    return this.audio.requestPermission();
  }

  async connect(sessionId: string) {
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
        this.fail(reason || `WebSocket closed (${code})`);
      },
    });
    this.socket = socket;
    await socket.connect();
    if (this.failed) return;
    await this.audio.start();
  }

  commit() {
    this.socket?.commit();
  }

  stop() {
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
      socket.stop();
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

  private sendAudio(chunk: ArrayBuffer) {
    if (this.closing) return;
    if (!this.socket?.sendAudio(chunk)) {
      this.fail("네트워크가 느려 오디오 전송을 계속할 수 없습니다.");
    }
  }

  private handleEvent(event: ServerEvent) {
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
}
