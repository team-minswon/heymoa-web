const PCM_BYTES_PER_SAMPLE = 2;

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

export function linearResample(
  samples: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) return samples.slice();
  const outputLength = Math.max(
    1,
    Math.floor((samples.length * outputSampleRate) / inputSampleRate)
  );
  const output = new Float32Array(outputLength);
  const ratio = inputSampleRate / outputSampleRate;

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const before = Math.floor(position);
    const after = Math.min(samples.length - 1, before + 1);
    const fraction = position - before;
    output[index] =
      samples[before] + (samples[after] - samples[before]) * fraction;
  }
  return output;
}

export function backlogMs(bufferedBytes: number, sampleRate: number) {
  return (bufferedBytes / (sampleRate * PCM_BYTES_PER_SAMPLE)) * 1000;
}

export class PcmChunkBatcher {
  private pending = new Int16Array(0);
  private readonly targetSamples: number;

  constructor(
    sampleRate: number,
    batchMs: number,
    private readonly emit: (chunk: ArrayBuffer) => void
  ) {
    if (batchMs < 40 || batchMs > 100) {
      throw new Error("PCM_BATCH_MUST_BE_40_TO_100_MS");
    }
    this.targetSamples = Math.round((sampleRate * batchMs) / 1000);
  }

  push(samples: Int16Array) {
    const combined = new Int16Array(this.pending.length + samples.length);
    combined.set(this.pending);
    combined.set(samples, this.pending.length);
    this.pending = combined;

    while (this.pending.length >= this.targetSamples) {
      const batch = this.pending.slice(0, this.targetSamples);
      this.pending = this.pending.slice(this.targetSamples);
      this.emit(batch.buffer);
    }
  }

  reset() {
    this.pending = new Int16Array(0);
  }
}

export type PcmAudioCaptureOptions = {
  onChunk: (chunk: ArrayBuffer) => void;
  onLevel?: (level: number) => void;
  targetSampleRate?: number;
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
  private readonly targetSampleRate: number;
  private readonly batcher: PcmChunkBatcher;

  constructor(private readonly options: PcmAudioCaptureOptions) {
    this.targetSampleRate = options.targetSampleRate ?? 24_000;
    this.batcher = new PcmChunkBatcher(
      this.targetSampleRate,
      options.batchMs ?? 40,
      options.onChunk
    );
  }

  async requestPermission() {
    this.stream ??= await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  }

  async start() {
    if (this.audioContext) return;

    await this.requestPermission();
    this.audioContext = new AudioContext();
    await this.audioContext.audioWorklet.addModule("/pcm-capture-worklet.js");
    this.source = this.audioContext.createMediaStreamSource(this.stream!);
    this.worklet = new AudioWorkletNode(
      this.audioContext,
      "pcm-capture-processor"
    );
    this.silentGain = this.audioContext.createGain();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.silentGain.gain.value = 0;
    this.worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      const sourceSamples = new Float32Array(event.data);
      const resampled = linearResample(
        sourceSamples,
        this.audioContext?.sampleRate ?? this.targetSampleRate,
        this.targetSampleRate
      );
      this.batcher.push(new Int16Array(float32ToPcm16(resampled)));
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
    this.worklet?.disconnect();
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.silentGain?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    await this.audioContext?.close();
    this.audioContext = null;
    this.stream = null;
    this.source = null;
    this.worklet = null;
    this.silentGain = null;
    this.analyser = null;
    this.batcher.reset();
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
