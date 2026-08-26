import { formatViewerDate, viewerDateKey } from "@/lib/format/date";

/**
 * 메시지마다 **그 앞에 구분선을 세울지**. 순수 함수다 — 스트리밍 중 토큰마다 다시 도는
 * 자리라 `useMemo`로 감싸 쓴다.
 *
 * **기준은 날짜 변화 하나뿐이다.** 첫 메시지도 여기 걸린다 — 앞이 없으므로 언제나 바뀐
 * 것이다. 같은 날 안에서는 몇 시간을 비우고 다시 물어도 안 선다.
 *
 * 한때 「같은 날이어도 30분 이상 벌어지면 다시 찍는다」는 규칙이 있었다. 그 30분은 잰 값이
 * 아니라 감으로 고른 값이었고, 근거 없는 수를 화면 규칙으로 굳히는 것보다 **날짜라는
 * 설명 가능한 기준 하나**로 두는 편이 낫다.
 *
 * 날짜는 **보는 사람의 시간대**로 자른다. UTC로 자르면 자정 근처 대화가 하루 밀린다.
 */
export function threadDividers(
  times: readonly string[],
  timeZone?: string
): boolean[] {
  let previousDay: string | null = null;

  return times.map((at) => {
    const day = viewerDateKey(at, timeZone);
    const isNewDay = previousDay === null || previousDay !== day;
    previousDay = day;
    return isNewDay;
  });
}

/**
 * 「오늘 오후 3:40」·「어제 오후 6:16」, 그 이전은 날짜로. 숫자와 월 이름은 `Intl`이
 * 보는 사람의 로케일대로 낸다 — 「오늘」·「어제」만 이 화면의 말이다.
 *
 * 해가 바뀌면 연도를 함께 적는다. 「1월 3일」만 있으면 올해인지 재작년인지 알 수 없다.
 */
export function dividerLabel(
  at: string,
  now: Date,
  locale?: string,
  timeZone?: string
) {
  const time = formatViewerDate(
    at,
    { hour: "numeric", minute: "2-digit", timeZone },
    locale
  );
  const day = viewerDateKey(at, timeZone);
  const today = viewerDateKey(now, timeZone);

  if (day === today) return `오늘 ${time}`;
  if (day === previousDayKey(today)) return `어제 ${time}`;

  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const date = formatViewerDate(
    at,
    {
      year: sameYear ? undefined : "numeric",
      month: "long",
      day: "numeric",
      timeZone,
    },
    locale
  );
  return `${date} ${time}`;
}

/** `2026-08-24`의 전날. 날짜만 있는 값이라 UTC 자정 위에서 계산해도 DST에 안 흔들린다. */
function previousDayKey(key: string) {
  return new Date(Date.parse(`${key}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}
