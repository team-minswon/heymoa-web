import { useTranslations } from "next-intl";

import { formatAppDate } from "@/lib/format/date";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

const DATE = { year: "numeric", month: "long", day: "numeric" } as const;
const DATE_TIME = { ...DATE, hour: "numeric", minute: "2-digit" } as const;

export function useBillingFormat() {
  const t = useTranslations("billing.format");
  const locale = useDisplayLocale();
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
    /** `null` 은 제한 없음입니다. 서버가 어느 쪽을 줘도 깨지지 않게 둘 다 그립니다. */
    allowance: (minutes: number | null | undefined) =>
      minutes == null
        ? t("unlimited")
        : t("minutes", { duration: duration(minutes) }),
    monthlyMinutes: (minutes: number) =>
      t("monthlyMinutes", { duration: duration(minutes) }),
    date: (iso: string) => formatAppDate(iso, DATE, locale),
    dateTime: (iso: string) => formatAppDate(iso, DATE_TIME, locale),
    card: (
      card:
        | {
            issuer: string | null;
            cardType: string | null;
            number: string | null;
          }
        | null
        | undefined
    ) =>
      [card?.issuer, card?.cardType, card?.number].filter(Boolean).join(" ") ||
      null,
    period: (period: { start: string; end: string }) =>
      t("period", {
        start: formatAppDate(period.start, DATE, locale),
        end: formatAppDate(period.end, DATE, locale),
      }),
  };
}
