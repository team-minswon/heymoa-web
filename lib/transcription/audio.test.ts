import { describe, expect, it, vi } from "vitest";
import {
  backlogMs,
  float32ToPcm16,
  linearResample,
  normalizePcm16Level,
  normalizeMicrophoneLevel,
  PcmChunkBatcher,
} from "@/lib/transcription/audio";

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

  it("linearly resamples 48 kHz input to 24 kHz", () => {
    const output = linearResample(
      new Float32Array([0, 0.5, 1, 0.5]),
      48000,
      24000
    );
    expect([...output]).toEqual([0, 1]);
  });

  it("batches 80 ms PCM chunks", () => {
    const emit = vi.fn();
    const batcher = new PcmChunkBatcher(24000, 80, emit);
    batcher.push(new Int16Array(960));
    expect(emit).not.toHaveBeenCalled();
    batcher.push(new Int16Array(960));
    expect(new Int16Array(emit.mock.calls[0][0])).toHaveLength(1920);
  });

  it("converts buffered PCM16 bytes to backlog time", () => {
    expect(backlogMs(48_000, 24_000)).toBe(1000);
  });
});
