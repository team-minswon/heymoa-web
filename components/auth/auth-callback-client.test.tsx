import {
  cleanup,
  fireEvent,
  render as baseRender,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { intlWrapper } from "@/components/help/test-intl";
import { CallbackProcessor } from "./auth-callback-client";

const render = (ui: ReactElement) => baseRender(ui, { wrapper: intlWrapper() });

const mocked = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    getMe: vi.fn(),
    setUser: vi.fn(),
    getWorkspaces: vi.fn(),
    settle: vi.fn(),
    recordNow: vi.fn(),
    logout: vi.fn(),
    replace,
    router: { replace },
  };
});
vi.mock("@/lib/auth/api", () => ({ getMe: mocked.getMe }));
vi.mock("@/lib/auth/login-consent", () => ({
  settleLoginConsent: mocked.settle,
  recordConsentNow: mocked.recordNow,
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    setUser: mocked.setUser,
    logout: mocked.logout,
    isLoggingOut: false,
  }),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getWorkspaces: mocked.getWorkspaces,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocked.router,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocked.settle.mockResolvedValue("done");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

it("익명 callback은 로그인 실패이며 사용자·제품 조회·returnTo 이동을 시작하지 않는다", async () => {
  mocked.getMe.mockResolvedValue(null);
  render(<CallbackProcessor returnTo="/settings" />);
  await screen.findByRole("heading", { name: "로그인에 실패했습니다" });
  expect(mocked.setUser).not.toHaveBeenCalled();
  expect(mocked.getWorkspaces).not.toHaveBeenCalled();
  expect(mocked.replace).not.toHaveBeenCalled();
});

it("확정된 사용자만 캐시에 넣고 승인된 returnTo로 이동한다", async () => {
  const user = {
    userId: "user",
    email: "user@example.com",
    name: "사용자",
    image: null,
  };
  mocked.getMe.mockResolvedValue(user);
  render(<CallbackProcessor returnTo="/settings" />);
  await waitFor(() => expect(mocked.replace).toHaveBeenCalledWith("/settings"));
  expect(mocked.setUser).toHaveBeenCalledWith(user);
  expect(mocked.getWorkspaces).not.toHaveBeenCalled();
});

it("신규 가입 표식만 전환으로 보내고 새로고침 전에 주소에서 지웁니다", async () => {
  const gtag = vi.fn();
  (window as { gtag?: unknown }).gtag = gtag;
  window.history.replaceState(
    null,
    "",
    "/auth/callback?signup=1&returnTo=%2Fsettings"
  );
  mocked.getMe.mockResolvedValue({
    userId: "new",
    name: "사용자",
    email: "new@example.com",
    image: null,
  });
  const first = render(<CallbackProcessor returnTo="/settings" />);
  await waitFor(() => expect(mocked.replace).toHaveBeenCalledWith("/settings"));
  expect(window.location.search).not.toContain("signup");
  expect(gtag).toHaveBeenCalledWith("event", "sign_up", { method: "google" });
  first.unmount();
  render(<CallbackProcessor returnTo="/settings" />);
  await waitFor(() => expect(mocked.setUser).toHaveBeenCalledTimes(2));
  expect(gtag).toHaveBeenCalledTimes(1);
  delete (window as { gtag?: unknown }).gtag;
});

const USER = {
  userId: "user",
  email: "user@example.com",
  name: "사용자",
  image: null,
};

it("동의가 기록되기 전에는 앱으로 들어가지 않는다", async () => {
  let settle!: (value: "done") => void;
  mocked.getMe.mockResolvedValue(USER);
  mocked.settle.mockReturnValue(
    new Promise((resolve) => {
      settle = resolve;
    })
  );
  render(<CallbackProcessor returnTo="/settings" />);
  await waitFor(() => expect(mocked.settle).toHaveBeenCalledTimes(1));
  expect(mocked.replace).not.toHaveBeenCalled();
  settle("done");
  await waitFor(() => expect(mocked.replace).toHaveBeenCalledWith("/settings"));
});

it("로그인 창에서 체크하지 않은 로그인은 체크박스를 받고, 체크해야 기록한다", async () => {
  mocked.getMe.mockResolvedValue(USER);
  mocked.settle.mockResolvedValue("ask");
  mocked.recordNow.mockResolvedValue(undefined);
  render(<CallbackProcessor returnTo="/settings" />);

  const agree = await screen.findByRole("button", { name: "동의하고 계속" });
  expect(agree).toHaveAttribute("aria-disabled", "true");
  expect(agree).toHaveAccessibleDescription("동의해야 계속할 수 있습니다.");

  // 체크 전에 누르면 기록하지 않고 체크박스로 보낸다(APP-1402).
  fireEvent.click(agree);
  expect(screen.getByRole("checkbox")).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent(
    "동의해야 계속할 수 있습니다."
  );
  expect(mocked.recordNow).not.toHaveBeenCalled();
  expect(mocked.replace).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("checkbox"));
  expect(agree).not.toHaveAttribute("aria-disabled");
  fireEvent.click(agree);

  await waitFor(() => expect(mocked.replace).toHaveBeenCalledWith("/settings"));
  expect(mocked.recordNow).toHaveBeenCalledTimes(1);
});

it("기록이 실패하면 대시보드로 가지 않고 다시 시도하게 한다", async () => {
  mocked.getMe.mockResolvedValue(USER);
  mocked.settle.mockRejectedValueOnce(new Error("network"));
  render(<CallbackProcessor returnTo="/settings" />);

  await screen.findByRole("heading", { name: "동의를 기록하지 못했습니다" });
  expect(mocked.replace).not.toHaveBeenCalled();

  mocked.settle.mockResolvedValueOnce("done");
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  await waitFor(() => expect(mocked.replace).toHaveBeenCalledWith("/settings"));
});

it("다시 시도 중 서버가 거절하면 서버 문구를 보이고 머문다", async () => {
  mocked.getMe.mockResolvedValue(USER);
  mocked.settle.mockRejectedValue({
    success: false,
    data: null,
    error: {
      code: "CONSENT_VERSION_OUTDATED",
      message: "약관이 새로 바뀌었습니다. 다시 확인한 뒤 동의해 주세요.",
    },
  });
  render(<CallbackProcessor returnTo="/settings" />);

  fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "약관이 새로 바뀌었습니다. 다시 확인한 뒤 동의해 주세요."
  );
  expect(mocked.replace).not.toHaveBeenCalled();
});

it("다시 시도하다 체크한 표시가 없다고 나오면 기록하지 않고 체크박스를 받는다", async () => {
  mocked.getMe.mockResolvedValue(USER);
  mocked.settle.mockRejectedValueOnce(new Error("network"));
  render(<CallbackProcessor returnTo="/settings" />);

  mocked.settle.mockResolvedValueOnce("ask");
  fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));

  await screen.findByRole("heading", { name: "약관에 동의해 주세요" });
  expect(mocked.recordNow).not.toHaveBeenCalled();
});

it("동의하지 않을 사람은 로그아웃으로 나간다", async () => {
  mocked.getMe.mockResolvedValue(USER);
  mocked.settle.mockResolvedValue("ask");
  render(<CallbackProcessor returnTo="/settings" />);

  fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));

  expect(mocked.logout).toHaveBeenCalledTimes(1);
  expect(mocked.replace).not.toHaveBeenCalled();
});
