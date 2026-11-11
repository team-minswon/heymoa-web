import { useTranslations } from "next-intl";

import { formatAppDate } from "@/lib/format/date";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

const DATE = { year: "numeric", month: "long", day: "numeric" } as const;

/** 금액·제공량·날짜 표시. 값은 전부 서버 응답이고, 여기는 모양만 정한다. */
export function useBillingFormat() {
  const t = useTranslations("billing.format");
  const locale = useDisplayLocale();
  return {
    money: (amount: number) =>
      t("money", { amount: new Intl.NumberFormat(locale).format(amount) }),
    /** `null`(제한 없음)과 숫자 둘 다 그린다 — 유료 상품이 무제한으로 바뀌는 중이라 서버가 어느 쪽을 줘도 깨지지 않게. */
    allowance: (minutes: number | null | undefined) =>
      minutes == null ? t("unlimited") : t("minutes", { count: minutes }),
    /** Free 의 월 제공량(비교표). */
    monthlyMinutes: (minutes: number) => t("monthlyMinutes", { count: minutes }),
    date: (iso: string) => formatAppDate(iso, DATE, locale),
    period: (period: { start: string; end: string }) =>
      t("period", {
        start: formatAppDate(period.start, DATE, locale),
        end: formatAppDate(period.end, DATE, locale),
      }),
  };
}
