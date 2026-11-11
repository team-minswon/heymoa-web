import { useTranslations } from "next-intl";

import { formatAppDate } from "@/lib/format/date";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

const DATE = { year: "numeric", month: "long", day: "numeric" } as const;

/** 금액·제공량·날짜 표시. 값은 전부 서버 응답이고, 여기는 모양만 정한다. */
export function useBillingFormat() {
  const t = useTranslations("billing.format");
  const locale = useDisplayLocale();
  /** 분을 「30시간」·「1시간 15분」·「45분」으로. 제공량이 시간 단위(월 30시간)라 분으로만 쓰면 읽기 어렵다. */
  const duration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return t("durationMinutes", { m });
    return m === 0 ? t("durationHours", { h }) : t("durationBoth", { h, m });
  };
  return {
    duration,
    money: (amount: number) =>
      t("money", { amount: new Intl.NumberFormat(locale).format(amount) }),
    /** `null`(제한 없음)과 숫자 둘 다 그린다 — 유료 상품이 무제한으로 바뀌는 중이라 서버가 어느 쪽을 줘도 깨지지 않게. */
    allowance: (minutes: number | null | undefined) =>
      minutes == null
        ? t("unlimited")
        : t("minutes", { duration: duration(minutes) }),
    /** Free 의 월 제공량(비교표). */
    monthlyMinutes: (minutes: number) =>
      t("monthlyMinutes", { duration: duration(minutes) }),
    date: (iso: string) => formatAppDate(iso, DATE, locale),
    period: (period: { start: string; end: string }) =>
      t("period", {
        start: formatAppDate(period.start, DATE, locale),
        end: formatAppDate(period.end, DATE, locale),
      }),
  };
}
