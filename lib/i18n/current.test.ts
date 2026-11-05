import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  acceptLanguage: null as string | null,
  user: null as { language: "ko" | "en" | null } | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "heymoa-lang" && state.cookie !== undefined
        ? { name, value: state.cookie }
        : undefined,
  }),
  headers: async () => ({
    get: (name: string) =>
      name === "accept-language" ? state.acceptLanguage : null,
  }),
}));
vi.mock("next/root-params", () => ({ lang: async () => undefined }));
vi.mock("@/lib/auth/server", () => ({
  getCurrentUserForSsr: async () => state.user,
}));

import { productLocale } from "@/lib/i18n/current";
import { requestLocale } from "@/lib/i18n/request-locale";

beforeEach(() => {
  state.cookie = undefined;
  state.acceptLanguage = null;
  state.user = null;
});

describe("제품 면 언어: 계정 → 쿠키 → 브라우저 언어 → ko", () => {
  it("계정 값이 쿠키와 브라우저 언어보다 이긴다", async () => {
    state.user = { language: "ko" };
    state.cookie = "en";
    state.acceptLanguage = "en-US,en";
    await expect(productLocale()).resolves.toBe("ko");
  });

  it("계정이 null 이면 쿠키를 쓴다", async () => {
    state.user = { language: null };
    state.cookie = "en";
    state.acceptLanguage = "ko-KR";
    await expect(productLocale()).resolves.toBe("en");
  });

  it("계정·쿠키가 없으면 브라우저 언어가 초기 기본값이다", async () => {
    state.acceptLanguage = "en-US,en";
    await expect(productLocale()).resolves.toBe("en");
    state.acceptLanguage = "en-US,en;q=0.9,ko;q=0.8";
    await expect(productLocale()).resolves.toBe("ko");
  });

  it("모르는 쿠키 값은 없는 것으로 본다", async () => {
    state.cookie = "ja";
    state.acceptLanguage = "en";
    await expect(requestLocale()).resolves.toBe("en");
  });

  it("아무 단서가 없으면 한국어다", async () => {
    await expect(productLocale()).resolves.toBe("ko");
  });
});
