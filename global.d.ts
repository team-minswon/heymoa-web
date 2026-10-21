import type { Messages } from "@/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

// 키 타입은 한국어 언어 파일에서 만든다. 없는 키를 쓰면 typecheck 가 실패한다.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
