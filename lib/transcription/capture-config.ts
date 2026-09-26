/**
 * 캡처 값의 원본. 계약과 튜닝을 가르는 이유는 고칠 때 무엇이 딸려 오는지가 다르기 때문이다.
 *
 * 계약을 바꾸면 asyncapi와 서버를 같이 고쳐야 한다. 튜닝은 브라우저 안에서만 뜻이 있어
 * 실측 결과로 언제든 바꾼다.
 */

/** 서버와 합의한 값. */
export const CAPTURE_CONTRACT = {
  sampleRate: 16_000,
  channelCount: 1,
  bytesPerSample: 2,
  /** 샘플 하나. 홀수 byte는 잘린 샘플이라 오류다. */
  minFrameBytes: 2,
  /** 1초분. asyncapi가 정한 값이고 지금까지 코드가 1 MiB로 어겨 왔다. */
  maxFrameBytes: 32_000,
} as const;

/** 브라우저 안에서만 뜻이 있는 값. */
export const CAPTURE_TUNING = {
  /** 배치의 약수여야 한다 — 아래 samplesPerBatch 주석 참조. */
  workletFrameMs: 20,
  /** 수확 체감 지점. 200ms로 늘려도 5 kbps만 아끼는데 조각 하나를 잃으면 단어 여러 개가 빈다. */
  batchMs: 100,
  /** 서버가 확정 안 한 소리를 메모리에 두는 한도(≈9.6MB). 넘으면 버리지 않고 캡처를 멈춘다. 모바일 사파리는 메모리 압박 때 탭을 죽인다. */
  memoryBufferMs: 5 * 60_000,
  /** 전송 정체가 이만큼 연속되면 회복 불가로 본다. */
  congestionMs: 10_000,
  /** WebSocket bufferedAmount 임계. 재전송 버퍼와 다른 것이다 — 소켓이 밀렸는지만 본다. */
  backpressureBytes: 96_000,
} as const;

/**
 * 배치 하나의 샘플 수.
 *
 * 배치가 워크릿 프레임의 정수배여야 **배치의 captureSamples를 그 배치를 연 첫 워크릿
 * 프레임의 값으로 쓸 수 있다.** 안 나눠떨어지면 배치가 두 프레임에 걸쳐 시작 위치가 모호해진다.
 */
export function samplesPerBatch(
  sampleRate: number = CAPTURE_CONTRACT.sampleRate
) {
  return Math.round((sampleRate * CAPTURE_TUNING.batchMs) / 1000);
}
