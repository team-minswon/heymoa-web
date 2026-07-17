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
} from "@/lib/transcription/protocol";

const AUTO_COMMIT_BYTES = 24_000 * 2 * 15;
const MAX_FRAME_BYTES = 1_048_576;

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
type Failure = {
  code: Extract<ServerEvent, { type: "error" }>["code"];
  message: string;
};

type ScenarioOptions = {
  sessionId: string;
  send: Send;
  requestClose?: Close;
  config?: Partial<VoiceActivityConfig>;
  script?: readonly string[];
  failure?: Failure;
};

type ScenarioPhase = "connecting" | "recording" | "stopping" | "closed";

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % length;
}

export function createMockTranscriptionScenario(options: ScenarioOptions) {
  return new MockTranscriptionScenario(options);
}

export class MockTranscriptionScenario {
  private phase: ScenarioPhase = "connecting";
  private itemSequence = 1;
  private sentenceIndex = 0;
  private recordedDurationMs = 0;
  private bufferedBytes = 0;
  private partialText = "";
  private utteranceStartedAtMs: number | null = null;
  private lastPartialAtMs = 0;
  private readonly config: VoiceActivityConfig;
  private readonly detector: VoiceActivityDetector;
  private readonly script: readonly string[];

  constructor(private readonly options: ScenarioOptions) {
    this.config = { ...DEFAULT_VOICE_ACTIVITY_CONFIG, ...options.config };
    this.detector = new VoiceActivityDetector(this.config);
    this.script =
      options.script ??
      KOREAN_MEETING_SCRIPTS[
        stableIndex(options.sessionId, KOREAN_MEETING_SCRIPTS.length)
      ];
  }

  open() {
    if (this.phase !== "connecting") return;
    this.phase = "recording";
    mockDb.updateSessionStatus(this.options.sessionId, "ACTIVE");
    this.options.send({
      type: "connected",
      sessionId: this.options.sessionId,
    });
  }

  async receiveFrame(frame: string | ArrayBufferLike | ArrayBufferView | Blob) {
    if (this.phase !== "recording") return;

    if (typeof frame === "string") {
      try {
        this.receiveCommand(parseClientCommand(frame));
      } catch {
        this.closeWithError(
          {
            code: "INVALID_CLIENT_MESSAGE",
            message: "지원하지 않는 클라이언트 메시지입니다.",
          },
          1008
        );
      }
      return;
    }

    const buffer = await this.toArrayBuffer(frame);
    if (
      buffer.byteLength < 2 ||
      buffer.byteLength > MAX_FRAME_BYTES ||
      buffer.byteLength % 2 !== 0
    ) {
      this.closeWithError(
        {
          code: "INVALID_AUDIO_FRAME",
          message: "PCM16 오디오 프레임 형식이 올바르지 않습니다.",
        },
        1008
      );
      return;
    }

    if (this.options.failure) {
      this.closeWithError(this.options.failure, 1011);
      return;
    }

    const frameDurationMs = (buffer.byteLength / 2 / 24_000) * 1000;
    this.recordedDurationMs += frameDurationMs;
    this.bufferedBytes += buffer.byteLength;
    const activity = this.detector.push(frameDurationMs, pcm16Rms(buffer));

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
      this.commitBufferedAudio(this.recordedDurationMs - activity.silenceMs);
      return;
    }
    if (this.bufferedBytes >= AUTO_COMMIT_BYTES) {
      this.commitBufferedAudio();
    }
  }

  fail(failure: Failure) {
    if (this.phase === "closed") return;
    this.closeWithError(failure, 1011);
  }

  dispose() {
    if (this.phase === "recording" || this.phase === "stopping") {
      mockDb.updateSessionStatus(this.options.sessionId, "INTERRUPTED");
    }
    this.phase = "closed";
  }

  private receiveCommand(command: ClientCommand) {
    if (command.type === "commit") {
      this.commitBufferedAudio();
      return;
    }

    this.commitBufferedAudio();
    this.phase = "stopping";
    mockDb.updateSessionStatus(this.options.sessionId, "COMPLETED");
    this.options.send({
      type: "completed",
      sessionId: this.options.sessionId,
    });
    this.phase = "closed";
    this.options.requestClose?.(1000, "completed");
  }

  private get utteranceId() {
    return `01K00000002${String(this.itemSequence).padStart(2, "0")}`;
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
    this.options.send({
      type: "partial",
      utteranceId: this.utteranceId,
      text: this.partialText,
    });
  }

  private commitBufferedAudio(endedAtMs = this.recordedDurationMs) {
    if (!this.partialText && this.utteranceStartedAtMs !== null) {
      this.revealPartial(this.config.partialEveryMs);
    }
    if (!this.partialText) {
      this.resetUtterance();
      return;
    }

    const utteranceId = this.utteranceId;
    const segment = mockDb.addSegment(this.options.sessionId, {
      text: this.partialText,
      startedAtMs: this.utteranceStartedAtMs ?? 0,
      endedAtMs: Math.max(this.utteranceStartedAtMs ?? 0, endedAtMs),
    });
    this.options.send({
      type: "final",
      segmentId: segment.segmentId,
      utteranceId,
      sequence: segment.sequence,
      text: segment.text,
      startedAtMs: segment.startedAtMs,
      endedAtMs: segment.endedAtMs,
    });
    this.itemSequence += 1;
    this.sentenceIndex += 1;
    this.resetUtterance();
  }

  private resetUtterance() {
    this.bufferedBytes = 0;
    this.partialText = "";
    this.utteranceStartedAtMs = null;
    this.lastPartialAtMs = 0;
    this.detector.reset();
  }

  private closeWithError(failure: Failure, code: 1008 | 1011) {
    this.options.send({ type: "error", ...failure });
    this.phase = "closed";
    mockDb.updateSessionStatus(this.options.sessionId, "INTERRUPTED");
    this.options.requestClose?.(code, failure.message);
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
