import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthStatus } from "@/components/auth/auth-status";
import { intlWrapper } from "@/components/help/test-intl";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: null, status: "checking" }),
}));

describe("인증 영어 화면", () => {
  it("로그인 확인 중 버튼이 영어다", () => {
    const { container } = render(<AuthStatus />, {
      wrapper: intlWrapper("en"),
    });
    expect(
      screen.getByRole("button", { name: "Checking sign-in status" })
    ).toHaveTextContent("Sign in");
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });
});
