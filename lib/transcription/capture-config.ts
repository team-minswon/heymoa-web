export const CAPTURE_CONTRACT = {
  sampleRate: 16_000,
  channelCount: 1,
  bytesPerSample: 2,
  minFrameBytes: 2,
  maxFrameBytes: 32_000,
} as const;

export const CAPTURE_TUNING = {
  workletFrameMs: 20,
  batchMs: 100,
  /** 서버가 확정 안 한 소리의 메모리 한도. 모바일 사파리는 메모리 압박 때 탭을 죽입니다. */
  memoryBufferMs: 5 * 60_000,
  /** 업체가 약 1.2배속으로 따라잡아 약 15초에 풀립니다. */
  liveWindowMs: 3_000,
  congestionMs: 10_000,
  backpressureBytes: 96_000,
} as const;

export function samplesPerBatch(
  sampleRate: number = CAPTURE_CONTRACT.sampleRate
) {
  return Math.round((sampleRate * CAPTURE_TUNING.batchMs) / 1000);
}
