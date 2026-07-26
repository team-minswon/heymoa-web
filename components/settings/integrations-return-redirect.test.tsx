import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntegrationsReturnRedirect } from "@/components/settings/integrations-return-redirect";

const navState = vi.hoisted(() => ({
  params: new URLSearchParams(""),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navState.replace }),
  useSearchParams: () => navState.params,
}));

const getWorkspaces = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({ getWorkspaces }));

function workspacesResponse(
  workspaces: { workspaceId: string; isDefault: boolean }[]
) {
  return { status: 200, data: { success: true, data: { workspaces } } };
}

describe("IntegrationsReturnRedirect", () => {
  beforeEach(() => {
    navState.params = new URLSearchParams("");
    navState.replace.mockClear();
    getWorkspaces.mockReset();
  });
  afterEach(cleanup);

  it("기본 워크스페이스로 쿼리를 그대로 넘겨 리다이렉트한다", async () => {
    navState.params = new URLSearchParams("provider=LINEAR&status=connected");
    getWorkspaces.mockResolvedValue(
      workspacesResponse([
        { workspaceId: "W1", isDefault: false },
        { workspaceId: "W2", isDefault: true },
      ])
    );

    render(<IntegrationsReturnRedirect />);

    await waitFor(() =>
      expect(navState.replace).toHaveBeenCalledWith(
        "/w/W2?provider=LINEAR&status=connected"
      )
    );
  });

  it("기본 워크스페이스가 없으면 첫 번째로 보낸다", async () => {
    navState.params = new URLSearchParams("provider=GITHUB&status=connected");
    getWorkspaces.mockResolvedValue(
      workspacesResponse([{ workspaceId: "W1", isDefault: false }])
    );

    render(<IntegrationsReturnRedirect />);

    await waitFor(() =>
      expect(navState.replace).toHaveBeenCalledWith(
        "/w/W1?provider=GITHUB&status=connected"
      )
    );
  });

  it("워크스페이스가 없으면 홈으로 보낸다", async () => {
    getWorkspaces.mockResolvedValue(workspacesResponse([]));

    render(<IntegrationsReturnRedirect />);

    await waitFor(() => expect(navState.replace).toHaveBeenCalledWith("/"));
  });
});
