/** 스트림이 건강할 때 힌트로 바꾼 쿼리가 쓰는 느슨한 안전망 간격(PRO-67 I02, 시작값). */
export const SAFETY_NET_MS = 60_000;

/**
 * 힌트로 바꾼 쿼리의 `refetchInterval`. **건강하면 안전망, 아니면 원래 간격**이다. 원래 간격이 `false`(종료 상태에서 멈추는
 * 게이트)면 그대로 둔다 — 안전망이 게이트를 열지 않는다. 원래 간격이 안전망보다 길면 원래 것을 쓴다.
 */
export function hintedInterval(healthy: boolean, interval: number): number;
export function hintedInterval(
  healthy: boolean,
  interval: number | false
): number | false;
export function hintedInterval(
  healthy: boolean,
  interval: number | false
): number | false {
  if (interval === false || !healthy) return interval;
  return Math.max(interval, SAFETY_NET_MS);
}
