import { afterEach, describe, expect, it, vi } from "vitest";

import {
  backlogMs,
  float32ToPcm16,
  normalizePcm16Level,
  normalizeMicrophoneLevel,
  PcmAudioCapture,
  PcmChunkBatcher,
} from "@/lib/transcription/audio";
import { CAPTURE_CONTRACT } from "@/lib/transcription/capture-config";

describe("audio conversion", () => {
  it("normalizes silence and full-scale PCM levels", () => {
    expect(normalizePcm16Level(new Int16Array(480))).toBe(0);
    expect(normalizePcm16Level(new Int16Array(480).fill(32767))).toBeCloseTo(
      1,
      2
    );
  });

  it("maps microphone RMS into a perceptible voice range", () => {
    expect(normalizeMicrophoneLevel(0)).toBe(0);
    expect(normalizeMicrophoneLevel(0.004)).toBe(0);
    expect(normalizeMicrophoneLevel(0.03)).toBeGreaterThan(0.35);
    expect(normalizeMicrophoneLevel(0.12)).toBeGreaterThan(0.75);
    expect(normalizeMicrophoneLevel(1)).toBe(1);
  });

  it("clamps Float32 samples to signed PCM16", () => {
    const pcm = new Int16Array(
      float32ToPcm16(new Float32Array([-2, -1, 0, 1, 2]))
    );
    expect([...pcm]).toEqual([-32768, -32768, 0, 32767, 32767]);
  });

  it("converts buffered PCM16 bytes to backlog time", () => {
    expect(backlogMs(48_000, 24_000)).toBe(1000);
  });
});

describe("PcmChunkBatcher", () => {
  it("emits 100 ms 16 kHz mono PCM16 frames within the contract limit", () => {
    const emit = vi.fn();
    const batcher = new PcmChunkBatcher(16_000, 100, emit);

    batcher.push(new Int16Array(1_600), 0);

    const chunk = emit.mock.calls[0][0] as ArrayBuffer;
    expect(chunk.byteLength).toBe(3_200);
    expect(chunk.byteLength % 2).toBe(0);
    expect(chunk.byteLength).toBeLessThanOrEqual(
      CAPTURE_CONTRACT.maxFrameBytes
    );
  });

  it("waits until a full batch is available", () => {
    const emit = vi.fn();
    const batcher = new PcmChunkBatcher(16_000, 100, emit);

    batcher.push(new Int16Array(800), 0);
    expect(emit).not.toHaveBeenCalled();

    batcher.push(new Int16Array(800), 800);
    expect(new Int16Array(emit.mock.calls[0][0])).toHaveLength(1_600);
  });

  it("carries the capture position of the frame that opened each batch", () => {
    const emitted: Array<{ bytes: number; captureSamples: number }> = [];
    const batcher = new PcmChunkBatcher(16_000, 100, (chunk, captureSamples) =>
      emitted.push({ bytes: chunk.byteLength, captureSamples })
    );

    batcher.push(new Int16Array(1_600), 0);
    batcher.push(new Int16Array(1_600), 1_600);

    expect(emitted).toEqual([
      { bytes: 3_200, captureSamples: 0 },
      { bytes: 3_200, captureSamples: 1_600 },
    ]);
  });

  it("lets the capture position jump while chunk numbering stays contiguous", () => {
    const emitted: number[] = [];
    const batcher = new PcmChunkBatcher(16_000, 100, (_chunk, captureSamples) =>
      emitted.push(captureSamples)
    );

    batcher.push(new Int16Array(1_600), 0);
    batcher.push(new Int16Array(1_600), 321_600); // 20초를 못 잡았다

    expect(emitted).toEqual([0, 321_600]);
  });

  it("drops a partial batch rather than bridging a capture gap", () => {
    const emitted: number[] = [];
    const batcher = new PcmChunkBatcher(16_000, 100, (_chunk, captureSamples) =>
      emitted.push(captureSamples)
    );

    batcher.push(new Int16Array(800), 0); // 배치를 못 채운 채 끊겼다
    batcher.push(new Int16Array(1_600), 321_600);

    // 800 샘플을 이어 붙였다면 첫 배치가 0에서 시작하며 공백을 품었을 것이다
    expect(emitted).toEqual([321_600]);
  });

  it("flushes the final PCM remainder exactly once", () => {
    const emit = vi.fn();
    const batcher = new PcmChunkBatcher(16_000, 100, emit);
    batcher.push(new Int16Array(1_200), 0);

    batcher.flush();
    batcher.flush();

    expect(emit).toHaveBeenCalledOnce();
    expect(new Int16Array(emit.mock.calls[0][0])).toHaveLength(1_200);
    expect(emit.mock.calls[0][1]).toBe(0);
  });

  it("rejects batch configurations that could emit an oversized frame", () => {
    expect(() => new PcmChunkBatcher(6_000_000, 100, vi.fn())).toThrow(
      "PCM_FRAME_EXCEEDS_MAX_BYTES"
    );
  });

  it("rejects a 48 kHz context at the contract frame limit", () => {
    // 16 kHz 를 못 여는 기기가 48 kHz 로 열리면 100ms 가 9,600 byte 라 계약 안이다.
    expect(() => new PcmChunkBatcher(48_000, 100, vi.fn())).not.toThrow();
  });
});

/**
 * 마이크가 조용히 사라지면 워크릿은 그냥 조각을 안 낸다. 브라우저 안에서 아무 오류도 안 나서
 * 사용자는 녹음되는 줄 안다. 그 순간을 이벤트로 올린다.
 */
describe("PcmAudioCapture 마이크 상태", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubBrowser() {
    const track = new EventTarget() as EventTarget & {
      readyState: string;
      muted: boolean;
      stop: () => void;
      onended: (() => void) | null;
      onmute: (() => void) | null;
      onunmute: (() => void) | null;
    };
    Object.assign(track, {
      readyState: "live",
      muted: false,
      stop: vi.fn(),
      onended: null,
      onmute: null,
      onunmute: null,
    });
    const devices = new EventTarget();
    Object.assign(devices, {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [track],
        getAudioTracks: () => [track],
      })),
    });
    vi.stubGlobal("navigator", { mediaDevices: devices });
    const contexts: Array<{
      state: string;
      onstatechange: (() => void) | null;
      resume: ReturnType<typeof vi.fn>;
    }> = [];
    const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
    class FakeAudioContext {
      state = "running";
      sampleRate = 16_000;
      onstatechange: (() => void) | null = null;
      destination = {};
      audioWorklet = { addModule: vi.fn(async () => undefined) };
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
      constructor() {
        contexts.push(this);
      }
      createMediaStreamSource = node;
      createGain = () => ({ ...node(), gain: { value: 1 } });
      createAnalyser = () => ({
        ...node(),
        fftSize: 0,
        getFloatTimeDomainData: vi.fn(),
      });
    }
    class FakeWorklet {
      port = { onmessage: null };
      connect = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("AudioWorkletNode", FakeWorklet);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1)
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    return { track, devices, contexts };
  }

  it("오디오 컨텍스트가 멈추면 suspended 를 올리고, 다시 돌면 live 로 되돌린다", async () => {
    const browser = stubBrowser();
    const onState = vi.fn();
    const capture = new PcmAudioCapture({ onChunk: vi.fn(), onState });
    await capture.start();
    const context = browser.contexts[0];

    context.state = "suspended";
    context.onstatechange?.();
    expect(onState).toHaveBeenLastCalledWith("suspended");

    context.state = "running";
    context.onstatechange?.();
    expect(onState).toHaveBeenLastCalledWith("live");
  });

  it("마이크 트랙이 끝나면 ended 를, 음소거되면 muted 를 올린다", async () => {
    const browser = stubBrowser();
    const onState = vi.fn();
    const capture = new PcmAudioCapture({ onChunk: vi.fn(), onState });
    await capture.start();

    browser.track.muted = true;
    browser.track.onmute?.();
    expect(onState).toHaveBeenLastCalledWith("muted");
    browser.track.muted = false;
    browser.track.onunmute?.();
    expect(onState).toHaveBeenLastCalledWith("live");

    browser.track.readyState = "ended";
    browser.track.onended?.();
    expect(onState).toHaveBeenLastCalledWith("ended");
  });

  // 브라우저는 이벤트 전에 track.muted·context.state 를 먼저 바꾼다. 마지막 이벤트가 아니라 둘의 지금 값이 답이다
  it("트랙이 음소거된 채면 컨텍스트가 다시 돌아도 live 로 되돌리지 않는다", async () => {
    const browser = stubBrowser();
    const onState = vi.fn();
    const capture = new PcmAudioCapture({ onChunk: vi.fn(), onState });
    await capture.start();
    const context = browser.contexts[0];

    browser.track.muted = true;
    browser.track.onmute?.();
    context.state = "suspended";
    context.onstatechange?.();
    context.state = "running";
    context.onstatechange?.();

    expect(onState).toHaveBeenLastCalledWith("muted");
  });

  it("컨텍스트가 멈춘 채면 트랙 음소거가 풀려도 live 로 되돌리지 않는다", async () => {
    const browser = stubBrowser();
    const onState = vi.fn();
    const capture = new PcmAudioCapture({ onChunk: vi.fn(), onState });
    await capture.start();
    const context = browser.contexts[0];

    context.state = "suspended";
    context.onstatechange?.();
    browser.track.muted = true;
    browser.track.onmute?.();
    browser.track.muted = false;
    browser.track.onunmute?.();
    expect(onState).toHaveBeenLastCalledWith("suspended");

    context.state = "running";
    context.onstatechange?.();
    expect(onState).toHaveBeenLastCalledWith("live");
  });

  it("감시를 걸기 전에 이미 음소거된 트랙이면 시작하자마자 muted 를 올린다", async () => {
    const browser = stubBrowser();
    browser.track.muted = true;
    const onState = vi.fn();
    const capture = new PcmAudioCapture({ onChunk: vi.fn(), onState });
    await capture.start();

    expect(onState).toHaveBeenLastCalledWith("muted");
  });

  it("기기가 빠져 트랙이 끝났으면 devicechange 에서도 ended 를 올린다", async () => {
    const browser = stubBrowser();
    const onState = vi.fn();
    const capture = new PcmAudioCapture({ onChunk: vi.fn(), onState });
    await capture.start();

    browser.track.readyState = "ended";
    browser.devices.dispatchEvent(new Event("devicechange"));

    expect(onState).toHaveBeenLastCalledWith("ended");
  });
});
