import { describe, expect, it } from "vitest";

import { decideLanguageSync } from "@/lib/i18n/account-sync";

describe("로그인 뒤 계정·쿠키 맞추기", () => {
  it("계정 값이 있으면 쿠키만 계정 값으로 맞춘다", () => {
    expect(
      decideLanguageSync({ account: "ko", cookie: "en", screen: "ko" })
    ).toEqual({ cookie: "ko" });
    expect(
      decideLanguageSync({ account: "en", cookie: null, screen: "en" })
    ).toEqual({ cookie: "en" });
  });

  it("계정 값과 쿠키가 같으면 아무것도 하지 않는다", () => {
    expect(
      decideLanguageSync({ account: "en", cookie: "en", screen: "en" })
    ).toEqual({});
  });

  it("계정이 비고 쿠키가 있으면 쿠키 언어를 계정에 옮긴다", () => {
    expect(
      decideLanguageSync({ account: null, cookie: "en", screen: "en" })
    ).toEqual({ account: "en" });
  });

  it("계정·쿠키가 비면 화면의 초기 기본값을 계정과 쿠키에 넣는다", () => {
    expect(
      decideLanguageSync({ account: null, cookie: null, screen: "en" })
    ).toEqual({ account: "en", cookie: "en" });
    expect(
      decideLanguageSync({ account: null, cookie: null, screen: "ko" })
    ).toEqual({ account: "ko", cookie: "ko" });
  });
});
