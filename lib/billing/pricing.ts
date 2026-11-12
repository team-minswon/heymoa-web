/**
 * 공개 페이지(랜딩 가격 안내)에 싣는 요금 값. 앱 안 화면의 금액·제공량은 server 가 내려 주는 값을 쓰고 이것을 읽지 않는다.
 */
export const PUBLIC_PRICING = {
  /** Pro 월 요금(원, 워크스페이스당). */
  proMonthlyKrw: 24_900,
  /** Free 월 녹음 한도(시간, 워크스페이스당). */
  freeMonthlyHours: 20,
  /** 전액 환불 기준 녹음 시간(약관 제13조). 지금은 Free 한도와 같지만 따로 정하는 값이다. */
  refundMaxRecordingHours: 20,
} as const;
