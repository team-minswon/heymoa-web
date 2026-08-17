import {
  CAPTURE_CONTRACT,
  CAPTURE_TUNING,
  samplesPerBatch,
} from "@/lib/transcription/capture-config";

const PCM_BYTES_PER_SAMPLE = CAPTURE_CONTRACT.bytesPerSample;

export function float32ToPcm16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * PCM_BYTES_PER_SAMPLE);
  const view = new DataView(buffer);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(index * PCM_BYTES_PER_SAMPLE, Math.round(value), true);
  });
  return buffer;
}

export function normalizePcm16Level(samples: Int16Array) {
  if (samples.length === 0) return 0;
  const meanSquare =
    samples.reduce((sum, sample) => {
      const normalized = sample / 32768;
      return sum + normalized * normalized;
    }, 0) / samples.length;
  return Math.min(1, Math.sqrt(meanSquare));
}

export function normalizeMicrophoneLevel(rms: number) {
  const noiseFloor = 0.005;
  if (rms <= noiseFloor) return 0;
  const normalized = Math.min(1, (rms - noiseFloor) / 0.115);
  return Math.min(1, Math.sqrt(normalized));
}

export function backlogMs(bufferedBytes: number, sampleRate: number) {
  return (bufferedBytes / (sampleRate * PCM_BYTES_PER_SAMPLE)) * 1000;
}

export type PcmBatchListener = (
  chunk: ArrayBuffer,
  captureSamples: number
) => void;

/**
 * 워크릿 프레임을 배치로 모은다.
 *
 * `captureSamples`를 함께 나르는 것이 핵심이다. 배처가 자기 샘플을 세면 못 받은 구간이
 * 없었던 일이 되므로, 워크릿이 준 캡처 위치를 그대로 통과시킨다.
 */
export class PcmChunkBatcher {
  private pending = new Int16Array(0);
  private pendingCaptureSamples = 0;
  private readonly targetSamples: number;

  constructor(
    sampleRate: number,
    batchMs: number,
    private readonly emit: PcmBatchListener
  ) {
    if (batchMs < 40 || batchMs > 100) {
      throw new Error("PCM_BATCH_MUST_BE_40_TO_100_MS");
    }
    this.targetSamples = Math.round((sampleRate * batchMs) / 1000);
    if (
      this.targetSamples < 1 ||
      this.targetSamples * PCM_BYTES_PER_SAMPLE > CAPTURE_CONTRACT.maxFrameBytes
    ) {
      throw new Error("PCM_FRAME_EXCEEDS_MAX_BYTES");
    }
  }

  push(samples: Int16Array, captureSamples: number) {
    // 캡처가 뛰면 pending 을 버리고 새 위치에서 시작한다. 점프를 가로질러 이어 붙이면
    // 배치 하나가 공백을 품게 되고, 그 배치의 시작 위치가 거짓이 된다.
    const expected = this.pendingCaptureSamples + this.pending.length;
    if (this.pending.length > 0 && captureSamples !== expected) {
      this.pending = new Int16Array(0);
    }
    if (this.pending.length === 0) {
      this.pendingCaptureSamples = captureSamples;
    }

    const combined = new Int16Array(this.pending.length + samples.length);
    combined.set(this.pending);
    combined.set(samples, this.pending.length);
    this.pending = combined;

    while (this.pending.length >= this.targetSamples) {
      const batch = this.pending.slice(0, this.targetSamples);
      this.pending = this.pending.slice(this.targetSamples);
      this.emit(batch.buffer, this.pendingCaptureSamples);
      this.pendingCaptureSamples += this.targetSamples;
    }
  }

  flush() {
    if (this.pending.length === 0) return;
    const remainder = this.pending;
    const captureSamples = this.pendingCaptureSamples;
    this.pending = new Int16Array(0);
    this.pendingCaptureSamples = captureSamples + remainder.length;
    this.emit(remainder.buffer, captureSamples);
  }

  reset() {
    this.pending = new Int16Array(0);
    this.pendingCaptureSamples = 0;
  }
}

export type PcmAudioCaptureOptions = {
  onChunk: PcmBatchListener;
  onLevel?: (level: number) => void;
  batchMs?: number;
};

export class PcmAudioCapture {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private levelFrame: number | null = null;
  private lastLevelAt = 0;
  private batcher: PcmChunkBatcher | null = null;
  /** 실제로 열린 값. 임의 레이트를 못 여는 기기가 있어 요청값과 다를 수 있다. */
  private openedSampleRate: number = CAPTURE_CONTRACT.sampleRate;

  constructor(private readonly options: PcmAudioCaptureOptions) {}

  get sampleRate() {
    return this.openedSampleRate;
  }

  async requestPermission() {
    this.stream ??= await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: CAPTURE_CONTRACT.channelCount,
        // 회의실 원거리 오디오라 끄면 전사가 확실히 나빠진다. 화자 임베딩에 어떤 영향인지는
        // 아직 모른다 — PRO-32 의 화자 정확도 측정에서 함께 본다.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  async start() {
    if (this.audioContext) return;

    await this.requestPermission();
    // 브라우저 리샘플러가 처리한다. 직접 선형 보간하면 안티에일리어싱이 없어
    // 나이퀴스트 위 성분이 접혀 들어온다.
    this.audioContext = new AudioContext({
      sampleRate: CAPTURE_CONTRACT.sampleRate,
    });
    this.openedSampleRate = this.audioContext.sampleRate;
    this.batcher = new PcmChunkBatcher(
      this.openedSampleRate,
      this.options.batchMs ?? CAPTURE_TUNING.batchMs,
      this.options.onChunk
    );
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    await this.audioContext.audioWorklet.addModule("/pcm-capture-worklet.js");
    this.source = this.audioContext.createMediaStreamSource(this.stream!);
    this.worklet = new AudioWorkletNode(
      this.audioContext,
      "pcm-capture-processor",
      { processorOptions: { frameMs: CAPTURE_TUNING.workletFrameMs } }
    );
    this.silentGain = this.audioContext.createGain();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.silentGain.gain.value = 0;
    this.worklet.port.onmessage = (
      event: MessageEvent<{ samples: ArrayBuffer; captureSamples: number }>
    ) => {
      this.batcher?.push(
        new Int16Array(float32ToPcm16(new Float32Array(event.data.samples))),
        event.data.captureSamples
      );
    };
    this.source.connect(this.worklet);
    this.source.connect(this.analyser);
    this.worklet.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
    this.publishLevel();
  }

  async stop() {
    if (this.levelFrame !== null) cancelAnimationFrame(this.levelFrame);
    this.levelFrame = null;
    this.options.onLevel?.(0);
    if (this.worklet) this.worklet.port.onmessage = null;
    this.worklet?.disconnect();
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.silentGain?.disconnect();
    this.batcher?.flush();
    this.stream?.getTracks().forEach((track) => track.stop());
    await this.audioContext?.close();
    this.audioContext = null;
    this.stream = null;
    this.source = null;
    this.worklet = null;
    this.silentGain = null;
    this.analyser = null;
    this.batcher?.reset();
    this.batcher = null;
  }

  private publishLevel = (now = performance.now()) => {
    if (!this.analyser) return;
    if (now - this.lastLevelAt >= 50) {
      const samples = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(samples);
      const pcm = new Int16Array(float32ToPcm16(samples));
      this.options.onLevel?.(
        normalizeMicrophoneLevel(normalizePcm16Level(pcm))
      );
      this.lastLevelAt = now;
    }
    this.levelFrame = requestAnimationFrame(this.publishLevel);
  };
}

export { samplesPerBatch };
