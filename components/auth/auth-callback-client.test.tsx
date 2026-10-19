import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CallbackProcessor } from "./auth-callback-client";

const mocked = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    getMe: vi.fn(),
    setUser: vi.fn(),
    getWorkspaces: vi.fn(),
    replace,
    router: { replace },
  };
});
vi.mock("@/lib/auth/api", () => ({ getMe: mocked.getMe }));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ setUser: mocked.setUser }),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getWorkspaces: mocked.getWorkspaces,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocked.router,
}));
beforeEach(() => {
  vi.clearAllMocks();
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
