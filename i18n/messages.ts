import enCommon from "@/messages/en/common.json";
import koCommon from "@/messages/ko/common.json";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 언어 파일은 `messages/<언어>/<이름공간>.json` 이다. **한국어가 기준**이고 키 타입도 한국어에서 만든다.
 * 이름공간을 더하면 두 표에 한 줄씩 더한다.
 */
const ko = { common: koCommon };

export type Messages = typeof ko;
export type Namespace = keyof Messages;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const en: DeepPartial<Messages> = { common: enCommon };

/**
 * 영어 키가 빠지면 빈칸이나 키 이름 대신 **한국어 원문**이 보이게 한국어 위에 덮어 합친다.
 * 빠뜨림 자체는 `messages.test.ts` 가 단계별 이름공간 목록으로 막는다.
 */
export function overlay<T>(base: T, top: unknown): T {
  if (
    typeof base !== "object" ||
    base === null ||
    typeof top !== "object" ||
    top === null
  ) {
    return (top ?? base) as T;
  }
  const merged: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(top)) {
    merged[key] = overlay((base as Record<string, unknown>)[key], value);
  }
  return merged as T;
}

export const messagesFor = (locale: Locale): Messages =>
  locale === "ko" ? ko : overlay(ko, en);

export const rawMessages = { ko, en };
