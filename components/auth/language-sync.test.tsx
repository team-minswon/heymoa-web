import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | {
    userId: string;
    name: string;
    email: string;
    image: null;
    language: "ko" | "en" | null;
  },
  screen: "en",
  mutate: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("next-intl", () => ({ useLocale: () => state.screen }));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: state.user, setUser: state.setUser }),
}));
vi.mock("@/lib/api/generated/users/users", () => ({
  useUpdateCurrentUser: () => ({ mutate: state.mutate }),
}));

import { LanguageSync } from "@/components/auth/language-sync";

const clearCookie = () => {
  document.cookie = "heymoa-lang=; path=/; max-age=0";
};

beforeEach(() => {
  clearCookie();
  state.mutate.mockReset();
  state.setUser.mockReset();
  state.screen = "en";
  state.user = {
    userId: "u",
    name: "n",
    email: "e",
    image: null,
    language: null,
  };
});
afterEach(clearCookie);

describe("LanguageSync", () => {
  it("계정이 비었으면 화면 언어를 계정과 쿠키에 한 번 넣는다", () => {
    const { rerender } = render(<LanguageSync />);
    rerender(<LanguageSync />);

    expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.mutate.mock.calls[0][0]).toEqual({
      data: { language: "en" },
    });
    expect(document.cookie).toContain("heymoa-lang=en");
  });

  it("계정 값이 있으면 저장하지 않고 쿠키만 계정 값으로 맞춘다", () => {
    state.user!.language = "ko";
    state.screen = "ko";
    document.cookie = "heymoa-lang=en; path=/";

    render(<LanguageSync />);

    expect(state.mutate).not.toHaveBeenCalled();
    expect(document.cookie).toContain("heymoa-lang=ko");
  });

  it("로그인 전에는 아무것도 하지 않는다", () => {
    state.user = null;
    render(<LanguageSync />);
    expect(state.mutate).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("heymoa-lang=");
  });

  it("저장이 성공하면 인증 캐시의 사용자 언어를 고친다", () => {
    render(<LanguageSync />);
    const { onSuccess } = state.mutate.mock.calls[0][1];
    onSuccess();
    expect(state.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en" })
    );
  });
});
