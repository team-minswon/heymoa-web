import type { useTranslations } from "next-intl";

export type DatesT = ReturnType<typeof useTranslations<"dates">>;

export type AppT = ReturnType<typeof useTranslations<never>>;

export type DocLanguage = { locale: string; t: AppT };
