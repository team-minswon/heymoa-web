import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";

const updateCurrentUser = vi.fn().mockResolvedValue({ status: 200 });

vi.mock("@/lib/api/generated/user/user", () => ({
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
  useUpdateCurrentUser: () => ({
    mutateAsync: updateCurrentUser,
    isPending: false,
  }),
}));

describe("AccountSettingsForm", () => {
  it("edits only the display name", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AccountSettingsForm />
      </QueryClientProvider>
    );
    expect(screen.getByDisplayValue("test@heymoa.com")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "김민수" },
    });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    await waitFor(() =>
      expect(updateCurrentUser).toHaveBeenCalledWith({
        data: { name: "김민수" },
      })
    );
  });
});
