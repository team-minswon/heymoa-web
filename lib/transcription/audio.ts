import type { AudioInputState } from "@heymoa/desktop-contracts";
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

/**
 * 마이크가 소리를 내고 있는가. `live` 가 아니면 워크릿이 조각을 안 내고, 브라우저 안에서는
 * 아무 오류도 안 난다. 사용자는 녹음되는 줄 안다.
 */
export type MicrophoneState = AudioInputState;

export type AudioInputs = {
  microphone: MediaStream;
  systemAudio?: MediaStream;
  release?: () => Promise<void> | void;
};
export type AudioInputStates = {
  microphone: MicrophoneState;
  systemAudio: MicrophoneState | null;
};
export type AudioInputLevels = {
  microphone: number;
  systemAudio: number | null;
};
export const AUDIO_METER_INTERVAL_MS = 50;
export const DUAL_INPUT_GAIN = 0.5;
export type PcmAudioCaptureOptions = {
  workletUrl?: string;
  onChunk: PcmBatchListener;
  onLevel?: (level: number) => void;
  onState?: (state: MicrophoneState) => void;
  batchMs?: number;
  acquireInputs?: (signal: AbortSignal) => Promise<AudioInputs>;
  onInputStates?: (states: AudioInputStates) => void;
  onInputLevels?: (levels: AudioInputLevels) => void;
};

export class PcmAudioCapture {
  private audioContext: AudioContext | null = null;
  private inputs: AudioInputs | null = null;
  private permissionPromise: Promise<void> | null = null;
  private startingPromise: Promise<void> | null = null;
  private generation = 0;
  private acquisitionAbort: AbortController | null = null;
  private nodes: AudioNode[] = [];
  private worklet: AudioWorkletNode | null = null;
  private analysers: Array<{
    name: "microphone" | "systemAudio";
    node: AnalyserNode;
    samples: Float32Array<ArrayBuffer>;
  }> = [];
  private levelFrame: number | null = null;
  private lastLevelAt = 0;
  private batcher: PcmChunkBatcher | null = null;
  private cleanupListeners: (() => void) | null = null;
  private openedSampleRate: number = CAPTURE_CONTRACT.sampleRate;
  constructor(private readonly options: PcmAudioCaptureOptions) {}
  get sampleRate() {
    return this.openedSampleRate;
  }

  requestPermission(): Promise<void> {
    if (this.inputs) return Promise.resolve();
    if (this.permissionPromise) return this.permissionPromise;
    const generation = this.generation;
    const abort = new AbortController();
    this.acquisitionAbort = abort;
    const request: Promise<AudioInputs> =
      this.options.acquireInputs?.(abort.signal) ??
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            channelCount: CAPTURE_CONTRACT.channelCount,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        .then((microphone) => ({ microphone }));
    const pending = request
      .then(async (inputs) => {
        if (generation !== this.generation) {
          await this.release(inputs);
          throw new Error("AUDIO_CAPTURE_CANCELLED");
        }
        if (
          !inputs.microphone.getAudioTracks().length ||
          (inputs.systemAudio && !inputs.systemAudio.getAudioTracks().length)
        ) {
          await this.release(inputs);
          throw new Error("AUDIO_INPUT_MISSING");
        }
        this.inputs = inputs;
      })
      .finally(() => {
        if (this.permissionPromise === pending) this.permissionPromise = null;
      });
    this.permissionPromise = pending;
    return pending;
  }

  start(): Promise<void> {
    if (this.startingPromise) return this.startingPromise;
    if (this.audioContext) return Promise.resolve();
    const generation = this.generation;
    const pending = this.initialize(generation).finally(() => {
      if (this.startingPromise === pending) this.startingPromise = null;
    });
    this.startingPromise = pending;
    return pending;
  }
  private assertCurrent(generation: number) {
    if (generation !== this.generation)
      throw new Error("AUDIO_CAPTURE_CANCELLED");
  }
  private async initialize(generation: number) {
    try {
      await this.requestPermission();
      this.assertCurrent(generation);
      const inputs = this.inputs!;
      const context = new AudioContext({
        sampleRate: CAPTURE_CONTRACT.sampleRate,
      });
      this.audioContext = context;
      this.openedSampleRate = context.sampleRate;
      if (context.sampleRate !== CAPTURE_CONTRACT.sampleRate)
        throw new Error("UNSUPPORTED_CAPTURE_SAMPLE_RATE");
      this.batcher = new PcmChunkBatcher(
        context.sampleRate,
        this.options.batchMs ?? CAPTURE_TUNING.batchMs,
        this.options.onChunk
      );
      if (context.state === "suspended") await context.resume();
      this.assertCurrent(generation);
      await context.audioWorklet.addModule(
        this.options.workletUrl ?? "/pcm-capture-worklet.js"
      );
      this.assertCurrent(generation);
      const worklet = new AudioWorkletNode(context, "pcm-capture-processor", {
        channelCount: 1,
        channelCountMode: "explicit",
        outputChannelCount: [1],
        processorOptions: { frameMs: CAPTURE_TUNING.workletFrameMs },
      });
      this.worklet = worklet;
      const mixer = context.createGain();
      mixer.channelCount = 1;
      mixer.channelCountMode = "explicit";
      const silent = context.createGain();
      silent.gain.value = 0;
      this.nodes.push(mixer, worklet, silent);
      for (const [name, stream] of [
        ["microphone", inputs.microphone],
        ["systemAudio", inputs.systemAudio],
      ] as const) {
        if (!stream) continue;
        const source = context.createMediaStreamSource(stream);
        const gain = context.createGain();
        gain.gain.value = inputs.systemAudio ? DUAL_INPUT_GAIN : 1;
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(gain);
        gain.connect(mixer);
        source.connect(analyser);
        this.nodes.push(source, gain, analyser);
        this.analysers.push({
          name,
          node: analyser,
          samples: new Float32Array(analyser.fftSize),
        });
      }
      worklet.port.onmessage = (
        event: MessageEvent<{ samples: ArrayBuffer; captureSamples: number }>
      ) => {
        if (generation !== this.generation) return;
        this.batcher?.push(
          new Int16Array(float32ToPcm16(new Float32Array(event.data.samples))),
          event.data.captureSamples
        );
      };
      mixer.connect(worklet);
      worklet.connect(silent);
      silent.connect(context.destination);
      this.watchInputs(context, inputs);
      this.lastLevelAt = 0;
      this.publishLevel();
    } catch (error) {
      if (generation === this.generation) await this.stop();
      throw error;
    }
  }
  private watchInputs(context: AudioContext, inputs: AudioInputs) {
    const tracks = [inputs.microphone, inputs.systemAudio].map(
      (stream) => stream?.getAudioTracks()[0]
    );
    const report = () => {
      const state = (track?: MediaStreamTrack): MicrophoneState => {
        if (!track || track.readyState === "ended") return "ended";
        if (track.muted) return "muted";
        return context.state === "running" ? "live" : "suspended";
      };
      const states = {
        microphone: state(tracks[0]),
        systemAudio: inputs.systemAudio ? state(tracks[1]) : null,
      };
      this.options.onState?.(states.microphone);
      this.options.onInputStates?.(states);
    };
    context.onstatechange = () => {
      const state = context.state as string;
      if (state === "suspended" || state === "interrupted")
        void context.resume().catch(() => undefined);
      report();
    };
    for (const track of tracks)
      if (track) {
        track.onended = report;
        track.onmute = report;
        track.onunmute = report;
      }
    navigator.mediaDevices.addEventListener("devicechange", report);
    this.cleanupListeners = () => {
      context.onstatechange = null;
      navigator.mediaDevices.removeEventListener("devicechange", report);
      for (const track of tracks)
        if (track) {
          track.onended = null;
          track.onmute = null;
          track.onunmute = null;
        }
    };
    report();
  }
  async stop() {
    this.generation++;
    this.acquisitionAbort?.abort();
    this.acquisitionAbort = null;
    this.permissionPromise = null;
    this.startingPromise = null;
    this.cleanupListeners?.();
    this.cleanupListeners = null;
    if (this.levelFrame !== null) cancelAnimationFrame(this.levelFrame);
    this.levelFrame = null;
    this.options.onLevel?.(0);
    this.options.onInputLevels?.({
      microphone: 0,
      systemAudio: this.inputs?.systemAudio ? 0 : null,
    });
    if (this.worklet) this.worklet.port.onmessage = null;
    for (const node of this.nodes) node.disconnect();
    this.nodes = [];
    this.analysers = [];
    this.worklet = null;
    this.batcher?.flush();
    this.batcher?.reset();
    this.batcher = null;
    const inputs = this.inputs,
      context = this.audioContext;
    this.inputs = null;
    this.audioContext = null;
    await Promise.all([
      inputs ? this.release(inputs) : Promise.resolve(),
      context?.close(),
    ]);
  }
  private async release(inputs: AudioInputs) {
    inputs.microphone.getTracks().forEach((track) => track.stop());
    inputs.systemAudio?.getTracks().forEach((track) => track.stop());
    await inputs.release?.();
  }
  private publishLevel = (now = performance.now()) => {
    if (!this.analysers.length) return;
    if (now - this.lastLevelAt >= AUDIO_METER_INTERVAL_MS) {
      const levels: AudioInputLevels = { microphone: 0, systemAudio: null };
      for (const { name, node, samples } of this.analysers) {
        node.getFloatTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) energy += sample * sample;
        levels[name] = normalizeMicrophoneLevel(
          Math.min(1, Math.sqrt(energy / samples.length))
        );
      }
      this.options.onLevel?.(levels.microphone);
      this.options.onInputLevels?.(levels);
      this.lastLevelAt = now;
    }
    this.levelFrame = requestAnimationFrame(this.publishLevel);
  };
}

export { samplesPerBatch };
