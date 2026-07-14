import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";

vi.mock("@/lib/api/generated/users/users", () => ({
  getGetCurrentUserQueryKey: () => ["current-user"],
  useGetCurrentUser: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          userId: "01K0000000003",
          name: "테스트 유저",
          email: "test@heymoa.com",
        },
      },
    },
  }),
}));

describe("AccountSettingsForm", () => {
  it("displays read-only profile information", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AccountSettingsForm />
      </QueryClientProvider>
    );
    expect(screen.getByDisplayValue("test@heymoa.com")).toBeDisabled();
    expect(screen.getByDisplayValue("테스트 유저")).toBeDisabled();
  });
});
