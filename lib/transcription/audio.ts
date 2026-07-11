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

type PcmAudioCaptureOptions = {
  onChunk: (chunk: ArrayBuffer) => void;
  targetSampleRate?: number;
  batchMs?: number;
};

export class PcmAudioCapture {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private readonly targetSampleRate: number;
  private readonly batcher: PcmChunkBatcher;

  constructor(private readonly options: PcmAudioCaptureOptions) {
    this.targetSampleRate = options.targetSampleRate ?? 24_000;
    this.batcher = new PcmChunkBatcher(
      this.targetSampleRate,
      options.batchMs ?? 80,
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
    await this.audioContext.audioWorklet.addModule(
      "/audio/pcm-capture-worklet.js"
    );
    this.source = this.audioContext.createMediaStreamSource(this.stream!);
    this.worklet = new AudioWorkletNode(
      this.audioContext,
      "pcm-capture-processor"
    );
    this.silentGain = this.audioContext.createGain();
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
    this.worklet.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
  }

  async stop() {
    this.worklet?.disconnect();
    this.source?.disconnect();
    this.silentGain?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    await this.audioContext?.close();
    this.audioContext = null;
    this.stream = null;
    this.source = null;
    this.worklet = null;
    this.silentGain = null;
    this.batcher.reset();
  }
}
