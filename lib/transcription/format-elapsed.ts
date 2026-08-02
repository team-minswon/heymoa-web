/**
 * 경과 시간을 `MM:SS` 로. 녹음 표면 셋(dock·pill·전역)이 같은 자리에 같은 폭으로 그려야 해서
 * 각자 만들지 않고 여기서 한 번만 만든다.
 */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
