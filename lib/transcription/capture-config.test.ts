import { describe, expect, it } from "vitest";

import {
  CAPTURE_CONTRACT,
  CAPTURE_TUNING,
  samplesPerBatch,
} from "@/lib/transcription/capture-config";

describe("capture-config", () => {
  it("배치가 워크릿 프레임의 정수배다", () => {
    expect(CAPTURE_TUNING.batchMs % CAPTURE_TUNING.workletFrameMs).toBe(0);
  });

  it("한 배치가 계약의 프레임 상한을 안 넘는다", () => {
    const bytes = samplesPerBatch() * CAPTURE_CONTRACT.bytesPerSample;
    expect(bytes).toBe(3_200);
    expect(bytes).toBeLessThanOrEqual(CAPTURE_CONTRACT.maxFrameBytes);
  });

  it("배치가 계약의 최소 프레임보다 크다", () => {
    const bytes = samplesPerBatch() * CAPTURE_CONTRACT.bytesPerSample;
    expect(bytes).toBeGreaterThanOrEqual(CAPTURE_CONTRACT.minFrameBytes);
  });

  it("샘플 수를 실제로 열린 레이트로 계산한다", () => {
    expect(samplesPerBatch(48_000)).toBe(4_800);
  });
});
