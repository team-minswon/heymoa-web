export const SAFETY_NET_MS = 60_000;

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
