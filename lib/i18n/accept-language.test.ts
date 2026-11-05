import { describe, expect, it } from "vitest";

import {
  ACCEPT_LANGUAGE_EN_ONLY,
  localeFromAcceptLanguage,
} from "@/lib/i18n/accept-language";

// Next 의 `has` 매칭과 같은 방식으로 감싼다(`^…$`, 플래그 없음).
const redirectMatches = (header: string) =>
  new RegExp(`^${ACCEPT_LANGUAGE_EN_ONLY}$`).test(header);

const SAMPLES: [header: string, expected: "ko" | "en"][] = [
  ["en-US,en", "en"],
  ["en-US,en;q=0.9", "en"],
  ["en", "en"],
  ["EN-us", "en"],
  ["fr-FR,fr;q=0.9,en;q=0.8", "en"],
  ["en-GB, en;q=0.8", "en"],
  ["en-US,en;q=0.9,ko;q=0.8", "ko"],
  ["ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7", "ko"],
  ["ko", "ko"],
  ["KO-kr", "ko"],
  ["en, ko", "ko"],
  ["ja-JP,ja", "ko"],
  ["*", "ko"],
  ["", "ko"],
  // `ko` 로 시작하는 다른 언어(코사어 `kok` 등)는 한국어가 아니다.
  ["kok,en", "en"],
];

describe("브라우저 언어 초기 기본값", () => {
  it.each(SAMPLES)("%s → %s", (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });

  it("헤더가 없으면 한국어다", () => {
    expect(localeFromAcceptLanguage(null)).toBe("ko");
    expect(localeFromAcceptLanguage(undefined)).toBe("ko");
  });

  it.each(SAMPLES)(
    "홈 이동 정규식이 판정 함수와 같다: %s",
    (header, expected) => {
      expect(redirectMatches(header)).toBe(expected === "en");
    }
  );
});
