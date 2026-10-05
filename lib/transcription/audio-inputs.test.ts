import { afterEach, describe, expect, it, vi } from "vitest";

import { PcmAudioCapture } from "./audio";

function fixture() {
  const track = () => ({
    readyState: "live",
    muted: false,
    stop: vi.fn(),
    onended: null as (() => void) | null,
    onmute: null as (() => void) | null,
    onunmute: null as (() => void) | null,
  });
  const microphone = track(),
    system = track();
  const stream = (value: ReturnType<typeof track>) =>
    ({
      getTracks: () => [value],
      getAudioTracks: () => [value],
    }) as unknown as MediaStream;
  const inputs = {
    microphone: stream(microphone),
    systemAudio: stream(system),
    release: vi.fn(),
  };
  const devices = new EventTarget();
  vi.stubGlobal("navigator", { mediaDevices: devices });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const gains: Array<
    ReturnType<typeof node> & {
      gain: { value: number };
      channelCount?: number;
      channelCountMode?: string;
    }
  > = [];
  const sources: Array<ReturnType<typeof node>> = [];
  const analysers: Array<
    ReturnType<typeof node> & {
      fftSize: number;
      getFloatTimeDomainData: ReturnType<typeof vi.fn>;
    }
  > = [];
  const addModule = vi.fn(async (): Promise<void> => undefined),
    close = vi.fn(async () => undefined);
  class Context {
    state = "running";
    sampleRate = 16_000;
    destination = {};
    audioWorklet = { addModule };
    close = close;
    resume = vi.fn();
    onstatechange: (() => void) | null = null;
    createGain() {
      const gain = { ...node(), gain: { value: 1 } };
      gains.push(gain);
      return gain;
    }
    createMediaStreamSource() {
      const source = node();
      sources.push(source);
      return source;
    }
    createAnalyser() {
      const analyser = {
        ...node(),
        fftSize: 0,
        getFloatTimeDomainData: vi.fn((samples: Float32Array) =>
          samples.fill(0.1)
        ),
      };
      analysers.push(analyser);
      return analyser;
    }
  }
  const port = { onmessage: null as ((event: MessageEvent) => void) | null };
  const workletOptions = vi.fn();
  class Worklet {
    port = port;
    connect = vi.fn();
    disconnect = vi.fn();
    constructor(...args: unknown[]) {
      workletOptions(...args);
    }
  }
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("AudioWorkletNode", Worklet);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    })
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return {
    inputs,
    microphone,
    system,
    gains,
    sources,
    analysers,
    addModule,
    close,
    port,
    workletOptions,
    frames,
  };
}

describe("두 입력의 PCM 캡처", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("두 소스를 한 mono mixer에 연결하고 하나의 captureSamples 시계로 100ms를 묶는다", async () => {
    const f = fixture(),
      onChunk = vi.fn();
    const capture = new PcmAudioCapture({
      onChunk,
      acquireInputs: async () => f.inputs,
    });
    await capture.start();
    expect(f.sources).toHaveLength(2);
    expect(f.gains[0]).toMatchObject({
      channelCount: 1,
      channelCountMode: "explicit",
    });
    expect(f.gains.slice(2).map((gain) => gain.gain.value)).toEqual([0.5, 0.5]);
    expect(f.gains[2].connect).toHaveBeenCalledWith(f.gains[0]);
    expect(f.gains[3].connect).toHaveBeenCalledWith(f.gains[0]);
    expect(f.workletOptions.mock.calls[0][2]).toMatchObject({
      channelCount: 1,
      outputChannelCount: [1],
    });
    for (let index = 0; index < 5; index++)
      f.port.onmessage?.({
        data: {
          samples: new Float32Array(320).fill(0.25).buffer,
          captureSamples: index * 320,
        },
      } as MessageEvent);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0].byteLength).toBe(3200);
    expect(onChunk.mock.calls[0][1]).toBe(0);
    await capture.stop();
  });

  it("시스템 트랙의 mute/end를 마이크 상태와 별도로 보고한다", async () => {
    const f = fixture(),
      onState = vi.fn(),
      onInputStates = vi.fn();
    const capture = new PcmAudioCapture({
      onChunk: vi.fn(),
      onState,
      onInputStates,
      acquireInputs: async () => f.inputs,
    });
    await capture.start();
    f.system.muted = true;
    f.system.onmute?.();
    expect(onInputStates).toHaveBeenLastCalledWith({
      microphone: "live",
      systemAudio: "muted",
    });
    f.system.readyState = "ended";
    f.system.onended?.();
    expect(onInputStates).toHaveBeenLastCalledWith({
      microphone: "live",
      systemAudio: "ended",
    });
    expect(onState).toHaveBeenLastCalledWith("live");
    await capture.stop();
    expect(f.microphone.onended).toBeNull();
    expect(f.system.onended).toBeNull();
  });

  it("worklet 로딩 중 중지하면 다시 캡처를 연결하지 않고 자원을 닫는다", async () => {
    const f = fixture();
    let resolve!: () => void;
    let requested!: () => void;
    const moduleRequested = new Promise<void>((done) => {
      requested = done;
    });
    f.addModule.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
          requested();
        })
    );
    const acquireInputs = vi.fn(async () => f.inputs);
    const capture = new PcmAudioCapture({ onChunk: vi.fn(), acquireInputs });
    const starting = capture.start();
    expect(capture.start()).toBe(starting);
    await moduleRequested;
    expect(f.addModule).toHaveBeenCalledTimes(1);
    await capture.stop();
    resolve();
    await expect(starting).rejects.toThrow("AUDIO_CAPTURE_CANCELLED");
    expect(acquireInputs).toHaveBeenCalledTimes(1);
    expect(f.sources).toHaveLength(0);
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.inputs.release).toHaveBeenCalledOnce();
    expect(f.microphone.stop).toHaveBeenCalledOnce();
    expect(f.system.stop).toHaveBeenCalledOnce();
  });

  it("미터 버퍼를 재사용하고 50ms 미만 프레임에서는 분석하지 않는다", async () => {
    const f = fixture();
    const capture = new PcmAudioCapture({
      onChunk: vi.fn(),
      acquireInputs: async () => f.inputs,
    });
    await capture.start();
    f.analysers.forEach((analyser) =>
      analyser.getFloatTimeDomainData.mockClear()
    );
    const now = performance.now() + 100;
    f.frames.at(-1)?.(now);
    f.frames.at(-1)?.(now + 10);
    f.frames.at(-1)?.(now + 50);
    for (const analyser of f.analysers) {
      expect(analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(2);
      expect(analyser.getFloatTimeDomainData.mock.calls[0][0]).toBe(
        analyser.getFloatTimeDomainData.mock.calls[1][0]
      );
    }
    await capture.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
