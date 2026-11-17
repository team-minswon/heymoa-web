import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { DocLanguage } from "./translator";
import { useDisplayLocale } from "./use-display-locale";

export function useDocLanguage(): DocLanguage {
  const t = useTranslations();
  const locale = useDisplayLocale();
  return useMemo(() => ({ t, locale }), [t, locale]);
}
