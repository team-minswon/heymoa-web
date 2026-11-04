import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { DocLanguage } from "./translator";
import { useDisplayLocale } from "./use-display-locale";

/** 복사본·회의록을 지금 화면 언어로 만드는 재료. 복사한 사람이 보던 화면과 같은 언어의 문서가 나온다. */
export function useDocLanguage(): DocLanguage {
  const t = useTranslations();
  const locale = useDisplayLocale();
  return useMemo(() => ({ t, locale }), [t, locale]);
}
