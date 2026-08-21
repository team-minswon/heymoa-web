import { mockDb } from "@/lib/mocks/db";
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
const MAX_FRAME_BYTES = CAPTURE_CONTRACT.maxFrameBytes;
/** 서버는 S3 적재(30초)마다 ACK한다. 목은 그보다 자주 보내 재전송 버퍼를 빨리 흔든다. */
const ACK_EVERY_CHUNKS = 30;
/** partial 꼬리에서 아직 안 굳은 어절 수. 화면의 두 농도를 실제로 움직이게 하는 값이다. */
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
  private partialConfirmed = "";
  private partialPending = "";
  private utteranceStartedAtMs: number | null = null;
  private lastPartialAtMs = 0;
  private lastChunkSeq: number | null = null;
  private lastCaptureEnd: number | null = null;
  private chunksSinceAck = 0;
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

  async receiveFrame(
    frame: string | ArrayBufferLike | ArrayBufferView | Blob,
    header?: AudioFrameHeader
  ) {
    if (this.phase !== "recording") return;

    if (typeof frame === "string") {
      try {
        parseClientCommand(frame);
        this.receiveCommand();
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

    this.observeHeader(header, buffer.byteLength);

    const frameDurationMs =
      (buffer.byteLength / 2 / CAPTURE_CONTRACT.sampleRate) * 1000;
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

  dispose() {
    if (this.phase === "recording" || this.phase === "stopping") {
      mockDb.updateSessionStatus(this.options.sessionId, "INTERRUPTED");
    }
    this.phase = "closed";
  }

  private receiveCommand() {
    // `stop` 하나뿐이다. `commit`은 커밋 단위가 없어지면서 사라졌고, 발화 경계는
    // 이제 침묵(`finalSilenceMs`)과 버퍼 상한이 정한다.
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

  /**
   * 헤더 둘이 서버가 볼 값과 같은지 본다. 어긋나면 목이 조용히 넘어가는 대신 경고를 남긴다 —
   * 여기서 잡히는 것이 서버를 짜기 전에 잡히는 것이다.
   */
  private observeHeader(header: AudioFrameHeader | undefined, bytes: number) {
    if (!header || Number.isNaN(header.chunkSeq)) {
      console.warn("mock transcription: 조각에 chunkSeq 헤더가 없습니다");
      return;
    }
    if (
      this.lastChunkSeq !== null &&
      header.chunkSeq !== this.lastChunkSeq + 1
    ) {
      // 구멍은 유실이고 되돌아감은 재전송이다. 서버는 전자를 UPLOAD 공백으로 읽는다.
      console.warn(
        `mock transcription: chunkSeq 가 ${this.lastChunkSeq} → ${header.chunkSeq} 로 튀었습니다`
      );
    }
    if (
      this.lastCaptureEnd !== null &&
      header.captureSamples < this.lastCaptureEnd
    ) {
      console.warn(
        `mock transcription: captureSamples 가 뒷걸음질했습니다 (${this.lastCaptureEnd} → ${header.captureSamples})`
      );
    }
    this.lastChunkSeq = header.chunkSeq;
    this.lastCaptureEnd =
      header.captureSamples + bytes / CAPTURE_CONTRACT.bytesPerSample;

    this.chunksSinceAck += 1;
    if (this.chunksSinceAck >= ACK_EVERY_CHUNKS) {
      this.chunksSinceAck = 0;
      this.options.send({ type: "ack", throughChunkSeq: header.chunkSeq });
    }
  }

  private get utteranceId() {
    return `01K00000002${String(this.itemSequence).padStart(2, "0")}`;
  }

  /** 화면에 나가는 것 = 확정 + 미확정. 서버의 `UtteranceAccumulator`가 하는 일과 같다. */
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
    const tokenCount = Math.min(tokens.length, revealSteps * 3);
    const revealed = tokens.slice(0, tokenCount);

    // **꼬리 두 어절은 아직 안 굳었다.** 업체가 다음 응답에서 통째로 갈아치울 수 있는
    // 구간이라, 목도 그만큼은 미확정으로 흘려야 화면의 농도 차이가 실제로 움직인다.
    // 앞은 확정이므로 다시 안 바뀐다 — 이어 붙이면 예전의 한 문자열과 같다.
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
      // 화자는 PRO-32가 회의 뒤에 채운다. 실시간에는 항상 null이다.
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
