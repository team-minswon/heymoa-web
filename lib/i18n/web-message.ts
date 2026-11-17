import en from "@/messages/en/errors.json";
import ko from "@/messages/ko/errors.json";

import { documentLocale } from "./document-locale";

type WebMessageKey = keyof typeof ko;

// 컴포넌트·훅은 useTranslations 를 씁니다. SSR 에는 document 가 없어 여기서는 늘 한국어가 나와 하이드레이션이 어긋납니다.
export function webMessage(
  key: WebMessageKey,
  values: Record<string, string> = {}
): string {
  return (documentLocale() === "en" ? en : ko)[key].replace(
    /\{(\w+)\}/g,
    (whole, name: string) => values[name] ?? whole
  );
}
