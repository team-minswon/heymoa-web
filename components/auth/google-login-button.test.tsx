import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleLoginButton } from "@/components/auth/google-login-button";

const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/lib/auth/paths", () => ({
  buildGoogleOAuthUrl: vi.fn(),
  getCurrentReturnTo: vi.fn(),
  isAuthApiConfigured: false,
}));

vi.mock("sonner", () => ({ toast }));

describe("GoogleLoginButton", () => {
  beforeEach(() => {
    toast.error.mockReset();
  });

  it("reports an unavailable login through Sonner without inline feedback", () => {
    render(<GoogleLoginButton />);

    fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));

    expect(toast.error).toHaveBeenCalledWith(
      "현재 로그인을 사용할 수 없습니다.",
      { id: "google-login-unavailable" }
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
