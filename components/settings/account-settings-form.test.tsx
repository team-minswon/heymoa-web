import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";

vi.mock("@/lib/api/generated/users/users", () => ({
  getGetCurrentUserQueryKey: () => ["current-user"],
  useGetCurrentUserSuspense: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          userId: "01K0000000003",
          name: "테스트 유저",
          email: "test@heymoa.com",
          image: "https://images.heymoa.test/users/test-user.png",
        },
      },
    },
  }),
}));

describe("AccountSettingsForm", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "Image",
      class {
        complete = true;
        naturalWidth = 1;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          this.onload?.();
        }
      }
    );
  });

  afterAll(() => vi.unstubAllGlobals());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  const renderForm = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AccountSettingsForm />
      </QueryClientProvider>
    );

  it("displays read-only profile information", async () => {
    renderForm();
    expect(screen.getByDisplayValue("test@heymoa.com")).toBeDisabled();
    expect(screen.getByDisplayValue("테스트 유저")).toBeDisabled();
    expect(
      await screen.findByRole("img", { name: "테스트 유저 프로필" })
    ).toHaveAttribute("src", expect.stringContaining("test-user.png"));
  });

  it("이용 통계 스위치를 그리지 않는다", () => {
    renderForm();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("워크스페이스 목록을 그리지 않는다", () => {
    renderForm();
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.queryByRole("button", { name: "기본으로 설정" })).toBeNull();
  });
});
