import { mockDb } from "@/lib/mocks/db";
import {
  helpDemoPack,
  isHelpDemoEnabled,
} from "@/lib/mocks/help-demo";
import {
  DEFAULT_VOICE_ACTIVITY_CONFIG,
  pcm16Rms,
  VoiceActivityDetector,
  type VoiceActivityConfig,
} from "@/lib/mocks/voice-activity";
import { CAPTURE_CONTRACT } from "@/lib/transcription/capture-config";
import {
  parseClientCommand,
  type ServerEvent,
} from "@/lib/transcription/protocol";

const AUTO_COMMIT_BYTES = CAPTURE_CONTRACT.sampleRate * 2 * 15;
const HELP_DEMO_COMMIT_BYTES = CAPTURE_CONTRACT.sampleRate * 2 * 3;
const HELP_DEMO_PARTIAL_EVERY_MS = 200;
const HELP_DEMO_TOKENS_PER_STEP = 4;
const MAX_FRAME_BYTES = CAPTURE_CONTRACT.maxFrameBytes;
const ACK_EVERY_CHUNKS = 30;
const PENDING_WORD_COUNT = 2;

export type AudioFrameHeader = {
  chunkSeq: number;
  captureSamples: number;
};

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

type Durability = { epoch: number; received: Set<number>; throughSeq: number };
const durability = new Map<string, Durability>();

function advance(state: Durability) {
  while (state.received.has(state.throughSeq + 1)) state.throughSeq += 1;
}

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % length;
}

function mockStopDelayMs() {
  try {
    return Number(window.localStorage.getItem("heymoa:mockStopDelayMs")) || 0;
  } catch {
    return 0;
  }
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
  private partialConfirmed = "";
  private partialPending = "";
  private utteranceStartedAtMs: number | null = null;
  private lastPartialAtMs = 0;
  private demoVoicedMs = 0;
  private lastChunkSeq: number | null = null;
  private lastCaptureEnd: number | null = null;
  private chunksSinceAck = 0;
  private durable!: Durability;
  private readonly attachReceived = new Set<number>();
  private readonly config: VoiceActivityConfig;
  private readonly detector: VoiceActivityDetector;
  private readonly script: readonly string[];

  constructor(private readonly options: ScenarioOptions) {
    this.config = {
      ...DEFAULT_VOICE_ACTIVITY_CONFIG,
      ...(isHelpDemoEnabled() && {
        partialEveryMs: HELP_DEMO_PARTIAL_EVERY_MS,
      }),
      ...options.config,
    };
    this.detector = new VoiceActivityDetector(this.config);
    this.script =
      options.script ??
      (isHelpDemoEnabled() ? helpDemoPack().liveScript : undefined) ??
      KOREAN_MEETING_SCRIPTS[
        stableIndex(options.sessionId, KOREAN_MEETING_SCRIPTS.length)
      ];
  }

  open(resendFromSeq?: number) {
    if (this.phase !== "connecting") return;
    const { sessionId } = this.options;
    if (
      mockDb.getSession(sessionId).status === "READY" ||
      !durability.has(sessionId)
    ) {
      durability.set(sessionId, {
        epoch: 0,
        received: new Set(),
        throughSeq: -1,
      });
    }
    this.durable = durability.get(sessionId)!;
    this.durable.epoch += 1;
    if (resendFromSeq !== undefined && Number.isInteger(resendFromSeq)) {
      this.durable.throughSeq = Math.max(
        this.durable.throughSeq,
        resendFromSeq - 1
      );
      advance(this.durable);
    }
    this.phase = "recording";
    mockDb.updateSessionStatus(sessionId, "ACTIVE");
    this.options.send({
      type: "connected",
      sessionId,
      epoch: this.durable.epoch,
      durableThroughSeq: this.durable.throughSeq,
    });
  }

  async receiveFrame(
    frame: string | ArrayBufferLike | ArrayBufferView | Blob,
    header?: AudioFrameHeader
  ) {
    if (this.phase !== "recording") return;

    if (typeof frame === "string") {
      let finalChunkSeq: number;
      try {
        ({ finalChunkSeq } = parseClientCommand(frame));
      } catch {
        this.closeWithError(
          {
            code: "INVALID_CLIENT_MESSAGE",
            message: "지원하지 않는 클라이언트 메시지입니다.",
          },
          1008
        );
        return;
      }
      this.receiveStop(finalChunkSeq);
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

    if (!this.observeHeader(header, buffer.byteLength)) return;

    const frameDurationMs =
      (buffer.byteLength / 2 / CAPTURE_CONTRACT.sampleRate) * 1000;
    this.recordedDurationMs += frameDurationMs;
    this.bufferedBytes += buffer.byteLength;
    const activity = isHelpDemoEnabled()
      ? {
          voicedMs: (this.demoVoicedMs += frameDurationMs),
          silenceMs: 0,
          isVoiced: true,
        }
      : this.detector.push(frameDurationMs, pcm16Rms(buffer));

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
    if (
      this.bufferedBytes >=
      (isHelpDemoEnabled() ? HELP_DEMO_COMMIT_BYTES : AUTO_COMMIT_BYTES)
    ) {
      this.commitBufferedAudio();
    }
  }

  dispose() {
    if (this.phase === "recording" || this.phase === "stopping") {
      try {
        mockDb.updateSessionStatus(this.options.sessionId, "INTERRUPTED");
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.message !== "TRANSCRIPTION_SESSION_NOT_FOUND"
        )
          throw error;
      }
    }
    this.phase = "closed";
  }

  private receiveStop(finalChunkSeq: number) {
    if (finalChunkSeq > this.durable.throughSeq) {
      this.options.send({
        type: "reattach",
        delayMs: 0,
        reason: "STORE_INCOMPLETE",
      });
      return;
    }
    this.commitBufferedAudio();
    this.phase = "stopping";
    const finish = () => {
      if (this.phase !== "stopping") return;
      mockDb.updateSessionStatus(this.options.sessionId, "COMPLETED");
      this.options.send({
        type: "completed",
        sessionId: this.options.sessionId,
      });
      this.phase = "closed";
      this.options.requestClose?.(1000, "completed");
    };
    const delayMs = mockStopDelayMs();
    if (delayMs > 0) setTimeout(finish, delayMs);
    else finish();
  }

  private observeHeader(header: AudioFrameHeader | undefined, bytes: number) {
    if (!header || Number.isNaN(header.chunkSeq)) {
      console.warn("mock transcription: 조각에 chunkSeq 헤더가 없습니다");
      return true;
    }
    const { chunkSeq, captureSamples } = header;
    if (
      chunkSeq <= this.durable.throughSeq ||
      this.attachReceived.has(chunkSeq)
    ) {
      return false;
    }
    if (
      this.lastChunkSeq !== null &&
      chunkSeq === this.lastChunkSeq + 1 &&
      this.lastCaptureEnd !== null &&
      captureSamples < this.lastCaptureEnd
    ) {
      console.warn(
        `mock transcription: captureSamples 가 뒷걸음질했습니다 (${this.lastCaptureEnd} → ${captureSamples})`
      );
    }
    this.lastChunkSeq = chunkSeq;
    this.lastCaptureEnd =
      captureSamples + bytes / CAPTURE_CONTRACT.bytesPerSample;
    this.attachReceived.add(chunkSeq);
    this.durable.received.add(chunkSeq);
    advance(this.durable);

    this.chunksSinceAck += 1;
    if (this.chunksSinceAck >= ACK_EVERY_CHUNKS) {
      this.chunksSinceAck = 0;
      if (this.durable.throughSeq >= 0) {
        this.options.send({
          type: "ack",
          throughChunkSeq: this.durable.throughSeq,
        });
      }
    }
    return true;
  }

  private get utteranceId() {
    return `01K00000002${String(this.itemSequence).padStart(2, "0")}`;
  }

  private get partialText() {
    return `${this.partialConfirmed}${this.partialPending}`;
  }

  private revealPartial(voicedMs: number) {
    const sentence = this.script[this.sentenceIndex % this.script.length];
    const tokens = sentence.split(" ");
    const revealSteps = Math.max(
      1,
      Math.floor(voicedMs / this.config.partialEveryMs)
    );
    const tokenCount = Math.min(
      tokens.length,
      revealSteps * (isHelpDemoEnabled() ? HELP_DEMO_TOKENS_PER_STEP : 3)
    );
    const revealed = tokens.slice(0, tokenCount);

    const confirmedCount = Math.max(0, revealed.length - PENDING_WORD_COUNT);
    this.partialConfirmed = revealed.slice(0, confirmedCount).join(" ");
    const pendingWords = revealed.slice(confirmedCount).join(" ");
    this.partialPending =
      this.partialConfirmed && pendingWords ? ` ${pendingWords}` : pendingWords;

    this.lastPartialAtMs = voicedMs;
    this.options.send({
      type: "partial",
      utteranceId: this.utteranceId,
      confirmedText: this.partialConfirmed,
      pendingText: this.partialPending,
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
      speakerLabel: null,
    });
    this.itemSequence += 1;
    this.sentenceIndex += 1;
    this.resetUtterance();
  }

  private resetUtterance() {
    this.bufferedBytes = 0;
    this.partialConfirmed = "";
    this.partialPending = "";
    this.utteranceStartedAtMs = null;
    this.lastPartialAtMs = 0;
    this.demoVoicedMs = 0;
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
