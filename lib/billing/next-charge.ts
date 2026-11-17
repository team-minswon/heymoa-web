const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000; // Asia/Seoul 은 서머타임이 없습니다

/** server 계약 「기간」 규칙입니다. anchor 는 승인 시각의 Asia/Seoul 일·시각이고, 다음 기간은 anchor 일을 다음 달 말일로 자른 날의 같은 시각입니다(1/31 → 2/28). */
export function nextMonthlyChargeAt(now: Date): string {
  const seoul = new Date(now.getTime() + SEOUL_OFFSET_MS);
  const year = seoul.getUTCFullYear();
  const month = seoul.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(seoul.getUTCDate(), lastDay);
  const next = Date.UTC(
    year,
    month,
    day,
    seoul.getUTCHours(),
    seoul.getUTCMinutes(),
    seoul.getUTCSeconds()
  );
  return new Date(next - SEOUL_OFFSET_MS).toISOString();
}
