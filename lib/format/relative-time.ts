/**
 * ISO 시각을 "방금/14분 전/어제/2주 전" 같은 상대 표기로. 순수 함수 — `now`를 주입해
 * 결정적으로 테스트한다. 렌더 타임 `Date.now()`를 쓰면 SSR/클라 시각 차로 하이드레이션이
 * 어긋나므로, 호출부(`RelativeTime`)가 마운트 후 `now`를 채운다.
 */
export function formatRelativeTime(iso: string, now: number): string {
  const diffMs = now - Date.parse(iso);
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day === 1) return "어제";
  if (day < 7) return `${day}일 전`;
  if (day < 14) return "지난주";
  if (day < 30) return `${Math.floor(day / 7)}주 전`;
  if (day < 365) return `${Math.floor(day / 30)}개월 전`;
  return `${Math.floor(day / 365)}년 전`;
}
