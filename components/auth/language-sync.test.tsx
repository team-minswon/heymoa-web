import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import type { ReactElement } from "react";
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
  mutateAsync: vi.fn(),
}));

vi.mock("next-intl", () => ({ useLocale: () => state.screen }));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock("@/lib/api/generated/users/users", () => ({
  useUpdateCurrentUser: () => ({ mutateAsync: state.mutateAsync }),
}));

import {
  LanguageSync,
  reloadForAccountLanguage,
} from "@/components/auth/language-sync";
import { initialLanguageSaveSettled } from "@/lib/i18n/initial-language-save";

let queryClient: QueryClient;
const renderSync = (ui: ReactElement = <LanguageSync />) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

const clearCookie = () => {
  document.cookie = "heymoa-lang=; path=/; max-age=0";
};
const reload = vi.fn();

beforeEach(() => {
  clearCookie();
  queryClient = new QueryClient();
  state.mutateAsync.mockReset().mockResolvedValue(undefined);
  reload.mockReset();
  reloadForAccountLanguage.run = reload;
  state.screen = "en";
  state.user = {
    userId: "u",
    name: "n",
    email: "e",
    image: null,
    language: null,
  };
  queryClient.setQueryData(["user"], state.user);
});
afterEach(clearCookie);

describe("LanguageSync", () => {
  it("계정이 비었으면 화면 언어를 계정과 쿠키에 한 번 넣고, 캐시는 언어만 고친다", async () => {
    const { rerender } = renderSync();
    rerender(
      <QueryClientProvider client={queryClient}>
        <LanguageSync />
      </QueryClientProvider>
    );
    await act(() => initialLanguageSaveSettled());

    expect(state.mutateAsync).toHaveBeenCalledTimes(1);
    expect(state.mutateAsync.mock.calls[0][0]).toEqual({
      data: { language: "en" },
    });
    expect(document.cookie).toContain("heymoa-lang=en");
    expect(queryClient.getQueryData(["user"])).toMatchObject({
      name: "n",
      language: "en",
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it("계정 값이 화면과 같으면 저장하지 않고 쿠키만 계정 값으로 맞춘다", () => {
    state.user!.language = "ko";
    state.screen = "ko";
    document.cookie = "heymoa-lang=en; path=/";

    renderSync();

    expect(state.mutateAsync).not.toHaveBeenCalled();
    expect(document.cookie).toContain("heymoa-lang=ko");
    expect(reload).not.toHaveBeenCalled();
  });

  it("SSR 이 계정을 놓쳐 화면이 계정과 다르면 쿠키를 계정 값으로 쓰고 한 번 새로 연다", () => {
    state.user!.language = "en";
    state.screen = "ko";

    renderSync();

    expect(document.cookie).toContain("heymoa-lang=en");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(state.mutateAsync).not.toHaveBeenCalled();
  });

  it("로그인 전에는 아무것도 하지 않는다", () => {
    state.user = null;
    renderSync();
    expect(state.mutateAsync).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("heymoa-lang=");
  });

  it("저장이 실패해도 알리지 않고 기다림은 끝난다", async () => {
    state.mutateAsync.mockRejectedValue(new Error("x"));
    renderSync();
    await act(() => initialLanguageSaveSettled());
    expect(queryClient.getQueryData(["user"])).toMatchObject({
      language: null,
    });
  });
});
