import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthStatus } from "@/components/auth/auth-status";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: null, status: "checking" }),
}));

describe("AuthStatus", () => {
  it("uses the login button geometry while authentication is being checked", () => {
    render(<AuthStatus />);

    const button = screen.getByRole("button", {
      name: "로그인 상태 확인 중",
    });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("h-8", "rounded-full");
    expect(button).toHaveTextContent("로그인");
    expect(button.firstElementChild).toHaveClass("opacity-0");
  });
});
