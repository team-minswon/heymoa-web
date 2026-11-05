import {
  act,
  cleanup,
  fireEvent,
  render as baseRender,
  screen,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messagesFor } from "@/i18n/messages";
import { trackInitialLanguageSave } from "@/lib/i18n/initial-language-save";

const state = vi.hoisted(() => ({
  phase: "idle" as string,
  mutate: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { userId: "u", name: "n", email: "e", image: null, language: "ko" },
    setUser: state.setUser,
  }),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({ phase: state.phase, session: null }),
  isRecordingLive: (recording: { phase: string }) =>
    recording.phase === "recording",
}));
vi.mock("@/lib/api/generated/users/users", () => ({
  useUpdateCurrentUser: () => ({ mutate: state.mutate }),
}));

import {
  LanguageSettings,
  reloadDocument,
} from "@/components/settings/language-settings";

const render = (ui: ReactElement, locale: "ko" | "en" = "ko") =>
  baseRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
        {children}
      </NextIntlClientProvider>
    ),
  });

const reload = vi.fn();
beforeEach(() => {
  state.phase = "idle";
  state.mutate.mockReset();
  state.setUser.mockReset();
  reload.mockReset();
  reloadDocument.run = reload;
  document.cookie = "heymoa-lang=; path=/; max-age=0";
});
afterEach(() => {
  cleanup();
  document.cookie = "heymoa-lang=; path=/; max-age=0";
});

describe("설정 > 언어", () => {
  it("선택지는 화면 언어와 상관없이 각 언어 자신의 이름이고, 지금 언어가 골라져 있다", () => {
    render(<LanguageSettings />, "en");
    expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "한국어" })).not.toBeChecked();
    expect(screen.getByText(/meetings and chats you start from now on/)).toBeTruthy();
  });

  it("고르면 계정에 저장하고, 성공한 뒤 쿠키를 쓰고 문서를 새로 연다", async () => {
    render(<LanguageSettings />);
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "English" }));
    });

    expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.mutate.mock.calls[0][0]).toEqual({ data: { language: "en" } });
    expect(reload).not.toHaveBeenCalled();
    // 저장하는 동안 다른 선택지는 막힌다.
    expect(screen.getByRole("radio", { name: "한국어" })).toBeDisabled();

    act(() => state.mutate.mock.calls[0][1].onSuccess());
    expect(document.cookie).toContain("heymoa-lang=en");
    expect(state.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en" })
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("저장이 실패하면 새로고침하지 않고 다시 고를 수 있다", async () => {
    render(<LanguageSettings />);
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "English" }));
    });
    act(() => state.mutate.mock.calls[0][1].onError(new Error("x")));

    expect(reload).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("heymoa-lang=en");
    expect(screen.getByRole("radio", { name: "English" })).not.toBeDisabled();
  });

  it("로그인 직후 초기값 저장이 가는 중이면 끝난 뒤에 보낸다", async () => {
    let finish!: () => void;
    trackInitialLanguageSave(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    render(<LanguageSettings />);
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "English" }));
    });
    expect(state.mutate).not.toHaveBeenCalled();

    await act(async () => {
      finish();
    });
    expect(state.mutate).toHaveBeenCalledTimes(1);
  });

  it("녹음 중에는 고를 수 없고 이유를 보인다", () => {
    state.phase = "recording";
    render(<LanguageSettings />);

    expect(screen.getByRole("status").textContent).toContain(
      "녹음 중에는 언어를 바꿀 수 없습니다"
    );
    expect(screen.getByRole("radio", { name: "English" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(state.mutate).not.toHaveBeenCalled();
  });
});
