import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CallbackProcessor } from "@/components/auth/auth-callback-client";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ setUser: vi.fn() }),
}));
vi.mock("@/lib/auth/api", () => ({
  getMe: vi.fn().mockResolvedValue({ name: "김민수" }),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getWorkspaces: vi.fn().mockResolvedValue({
    status: 200,
    data: {
      success: true,
      data: {
        workspaces: [
          { workspaceId: "01K0000000007", isDefault: false },
          { workspaceId: "01K0000000000", isDefault: true },
        ],
      },
    },
  }),
}));

describe("Auth callback", () => {
  it("redirects to the explicit default workspace", async () => {
    render(<CallbackProcessor />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/w/01K0000000000")
    );
  });
});
