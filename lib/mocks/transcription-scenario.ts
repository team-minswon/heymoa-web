import { mockDb } from "@/lib/mocks/db";
import {
  DEFAULT_VOICE_ACTIVITY_CONFIG,
  pcm16Rms,
  VoiceActivityDetector,
  type VoiceActivityConfig,
} from "@/lib/mocks/voice-activity";
import {
  parseClientCommand,
  type ClientCommand,
  type ServerEvent,
  type TranscriptionSessionStatus,
} from "@/lib/transcription/protocol";

const KOREAN_MEETING_SCRIPTS = [
  [
    "오늘 제품 회의에서는 온보딩 개선안을 먼저 확인하겠습니다.",
    "사용자 테스트는 다음 주 화요일까지 다섯 명을 대상으로 진행합니다.",
    "결과를 정리한 뒤 금요일 회의에서 최종 우선순위를 결정하겠습니다.",
  ],
  [
    "이번 주 목표와 현재 진행 상황을 차례로 확인하겠습니다.",
    "디자인 검토 의견은 오늘 오후까지 문서에 정리해 주세요.",
    "남은 쟁점은 다음 회의에서 담당자와 일정을 확정하겠습니다.",
  ],
] as const;

type Send = (event: ServerEvent) => void;
type Close = (code: number, reason: string) => void;

type ScenarioOptions = {
  sessionId: string;
  send: Send;
  requestClose?: Close;
  config?: Partial<VoiceActivityConfig>;
  script?: readonly string[];
};

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (const character of value)
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % length;
}

export function createMockTranscriptionScenario(options: ScenarioOptions) {
  return new MockTranscriptionScenario(
    options.sessionId,
    options.send,
    options.requestClose,
    options.config,
    options.script
  );
}

export class MockTranscriptionScenario {
  private status: TranscriptionSessionStatus = "CONNECTING";
  private itemSequence = 1;
  private sentenceIndex = 0;
  private recordedDurationMs = 0;
  private partialText = "";
  private utteranceStartedAtMs: number | null = null;
  private lastPartialAtMs = 0;
  private disposed = false;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: VoiceActivityConfig;
  private readonly detector: VoiceActivityDetector;
  private readonly script: readonly string[];

  constructor(
    private readonly sessionId: string,
    private readonly send: Send,
    private readonly requestClose: Close = () => undefined,
    config: Partial<VoiceActivityConfig> = {},
    script?: readonly string[]
  ) {
    this.config = { ...DEFAULT_VOICE_ACTIVITY_CONFIG, ...config };
    this.detector = new VoiceActivityDetector(this.config);
    this.script =
      script ??
      KOREAN_MEETING_SCRIPTS[
        stableIndex(sessionId, KOREAN_MEETING_SCRIPTS.length)
      ];
    this.recordedDurationMs = mockDb.getSession(sessionId).recordedDurationMs;
  }

  open() {
    if (this.disposed) return;
    this.send({ type: "SESSION_READY", sessionId: this.sessionId });
    this.setStatus("STREAMING");
  }

  receive(command: ClientCommand) {
    if (this.disposed) return;
    switch (command.type) {
      case "TURN_COMMIT":
        this.commitPartial();
        break;
      case "SESSION_PAUSE":
        this.commitPartial();
        this.setStatus("PAUSED");
        break;
      case "SESSION_RESUME":
        this.setStatus("STREAMING");
        break;
      case "SESSION_COMPLETE":
        if (this.status === "FINALIZING" || this.status === "COMPLETED") break;
        this.commitPartial();
        this.setStatus("FINALIZING");
        this.setStatus("COMPLETED");
        this.send({ type: "SESSION_COMPLETED", sessionId: this.sessionId });
        this.closeTimer = setTimeout(
          () => this.requestClose(1000, "completed"),
          0
        );
        break;
      case "PING":
        this.send({ type: "PONG" });
        break;
    }
  }

  fail(error: {
    code: Extract<ServerEvent, { type: "ERROR" }>["code"];
    message: string;
  }) {
    if (this.disposed || this.status === "COMPLETED") return;
    this.setStatus("FAILED");
    this.send({ type: "ERROR", ...error, retryable: false });
    this.disposed = true;
    this.requestClose(4500, error.message);
  }

  async receiveFrame(frame: string | ArrayBufferLike | ArrayBufferView | Blob) {
    if (typeof frame === "string") {
      this.receive(parseClientCommand(frame));
      return;
    }
    if (this.status !== "STREAMING" || this.disposed) return;

    const buffer = await this.toArrayBuffer(frame);
    const frameDurationMs = (buffer.byteLength / 2 / 24_000) * 1000;
    this.recordedDurationMs += frameDurationMs;
    const activity = this.detector.push(frameDurationMs, pcm16Rms(buffer));
    mockDb.updateSessionStatus(
      this.sessionId,
      this.status,
      this.recordedDurationMs
    );

    if (activity.isVoiced && this.utteranceStartedAtMs === null) {
      this.utteranceStartedAtMs = Math.max(
        0,
        this.recordedDurationMs - activity.voicedMs
      );
    }
    if (
      activity.isVoiced &&
      activity.silenceMs === 0 &&
      activity.voicedMs - this.lastPartialAtMs >= this.config.partialEveryMs
    ) {
      this.revealPartial(activity.voicedMs);
    }
    if (activity.isVoiced && activity.silenceMs >= this.config.finalSilenceMs) {
      this.commitPartial(this.recordedDurationMs - activity.silenceMs);
    }
  }

  dispose() {
    this.disposed = true;
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  private get itemId() {
    return `provider-item-${this.itemSequence}`;
  }

  private setStatus(status: TranscriptionSessionStatus) {
    this.status = status;
    mockDb.updateSessionStatus(this.sessionId, status, this.recordedDurationMs);
    this.send({
      type: "SESSION_STATUS",
      status,
      recordedDurationMs: this.recordedDurationMs,
    });
  }

  private revealPartial(voicedMs: number) {
    const sentence = this.script[this.sentenceIndex % this.script.length];
    const tokens = sentence.split(" ");
    const revealSteps = Math.max(
      1,
      Math.floor(voicedMs / this.config.partialEveryMs)
    );
    const tokenCount = Math.min(tokens.length, revealSteps * 3);
    this.partialText = tokens.slice(0, tokenCount).join(" ");
    this.lastPartialAtMs = voicedMs;
    this.send({
      type: "TRANSCRIPT_PARTIAL",
      itemId: this.itemId,
      text: this.partialText,
      startedAtMs: this.utteranceStartedAtMs ?? 0,
    });
  }

  private commitPartial(endedAtMs = this.recordedDurationMs) {
    if (!this.partialText && this.utteranceStartedAtMs !== null) {
      this.revealPartial(this.config.partialEveryMs);
    }
    if (!this.partialText) {
      this.detector.reset();
      return;
    }
    const itemId = this.itemId;
    const segment = mockDb.addSegment(this.sessionId, {
      text: this.partialText,
      startedAtMs: this.utteranceStartedAtMs ?? 0,
      endedAtMs: Math.max(this.utteranceStartedAtMs ?? 0, endedAtMs),
    });
    this.send({ type: "TRANSCRIPT_FINAL", itemId, segment });
    this.itemSequence += 1;
    this.sentenceIndex += 1;
    this.partialText = "";
    this.utteranceStartedAtMs = null;
    this.lastPartialAtMs = 0;
    this.detector.reset();
  }

  private async toArrayBuffer(
    frame: ArrayBufferLike | ArrayBufferView | Blob
  ): Promise<ArrayBuffer> {
    if (frame instanceof Blob) return frame.arrayBuffer();
    if (ArrayBuffer.isView(frame)) {
      return frame.buffer.slice(
        frame.byteOffset,
        frame.byteOffset + frame.byteLength
      ) as ArrayBuffer;
    }
    return frame.slice(0) as ArrayBuffer;
  }
}
