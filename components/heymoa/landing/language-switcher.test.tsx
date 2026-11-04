import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messagesFor } from "@/i18n/messages";

const state = vi.hoisted(() => ({
  userId: undefined as string | undefined,
  update: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/help/start" }));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuthUserId: () => state.userId,
}));
vi.mock("@/lib/api/generated/users/users", () => ({
  updateCurrentUser: state.update,
}));

import { LanguageSwitcher } from "@/components/heymoa/landing/language-switcher";

const renderSwitcher = () =>
  render(
    <NextIntlClientProvider locale="ko" messages={messagesFor("ko")}>
      <LanguageSwitcher />
    </NextIntlClientProvider>
  );

beforeEach(() => {
  state.userId = undefined;
  state.update.mockReset().mockResolvedValue(undefined);
  document.cookie = "heymoa-lang=; path=/; max-age=0";
});
afterEach(cleanup);

describe("랜딩 푸터 언어 선택", () => {
  it("같은 페이지의 다른 언어판으로 가고 고른 언어를 쿠키에 남긴다", () => {
    renderSwitcher();
    const english = screen.getByRole("link", { name: "English" });
    expect(english.getAttribute("href")).toBe("/en/help/start");

    english.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(english);

    expect(document.cookie).toContain("heymoa-lang=en");
    expect(state.update).not.toHaveBeenCalled();
  });

  it("로그인했으면 계정 언어도 keepalive 로 함께 바꾼다", () => {
    state.userId = "user-1";
    renderSwitcher();
    const english = screen.getByRole("link", { name: "English" });
    english.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(english);

    expect(state.update).toHaveBeenCalledWith(
      { language: "en" },
      { keepalive: true }
    );
  });
});
