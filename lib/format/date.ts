export const APP_TIME_ZONE = "Asia/Seoul";

export function getAppDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${byType.year}-${byType.month}-${byType.day}`;
}

/**
 * **보는 사람의 시간대·로케일로** 포맷한다. 아래 `formatAppDate`와 다른 물건이다 —
 * 그쪽은 `APP_TIME_ZONE` 고정이고, 이유는 서버 HTML과 첫 클라이언트 렌더가 같아야 하기
 * 때문이다(hydration).
 *
 * **서버를 한 번도 안 지나는 표면만 이걸 쓴다.** 지금 유일한 손님은 개인 챗봇 패널이고,
 * 그 패널은 한 번 열기 전에는 마운트조차 되지 않아 SSR을 지나지 않는다. 서버에서 렌더되는
 * 자리에 쓰면 hydration이 갈린다.
 *
 * `locale`은 검사에서만 넘긴다 — 안 넘기면 플랫폼이 보는 사람의 로케일을 고른다.
 */
export function formatViewerDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
  locale?: string
) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * 보는 사람의 시간대 기준 `YYYY-MM-DD`. **날짜가 같은지만 보는 값**이라 로케일은 고정한다 —
 * `en-CA`가 ISO와 같은 순서를 내므로 문자열 비교가 곧 날짜 비교다.
 */
export function viewerDateKey(value: string | Date, timeZone?: string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatAppDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
  locale = "ko-KR"
) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}
