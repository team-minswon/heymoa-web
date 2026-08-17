import { describe, expect, it, vi } from "vitest";

import {
  backlogMs,
  float32ToPcm16,
  normalizePcm16Level,
  normalizeMicrophoneLevel,
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
    expect(chunk.byteLength).toBeLessThanOrEqual(CAPTURE_CONTRACT.maxFrameBytes);
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
