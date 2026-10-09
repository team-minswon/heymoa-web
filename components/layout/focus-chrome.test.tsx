import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FocusFooter, FocusTopBar } from "@/components/layout/focus-chrome";

const auth = vi.hoisted(() => ({
  status: "authenticated" as "authenticated" | "anonymous" | "checking",
  logout: vi.fn(),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ ...auth, isLoggingOut: false }),
}));

afterEach(cleanup);

describe("FocusTopBar", () => {
  beforeEach(() => {
    auth.status = "authenticated";
    auth.logout.mockReset();
  });

  // 초대가 다른 이메일용이면 계정을 바꿀 길이 이것뿐이다
  it("로그인했으면 메뉴 없이 로고와 로그아웃만 둔다", () => {
    render(<FocusTopBar />);

    expect(screen.getByText("HeyMoa")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it("로그인 전에는 로그아웃을 두지 않는다", () => {
    auth.status = "anonymous";
    render(<FocusTopBar />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("FocusFooter", () => {
  it("약관과 개인정보 처리방침만 잇는다", () => {
    render(<FocusFooter />);

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href"))
    ).toEqual(["/terms", "/privacy"]);
  });
});
