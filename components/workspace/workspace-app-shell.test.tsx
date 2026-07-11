import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";

vi.mock("@/lib/api/generated/workspace/workspace", () => ({
  useGetWorkspace: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaceId: "01K0000000000",
          name: "김민수의 워크스페이스",
        },
      },
    },
  }),
}));

describe("WorkspaceAppShell", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("renders one app navigation and a main content region", () => {
    render(
      <WorkspaceAppShell workspaceId="01K0000000000">
        <p>노트 목록</p>
      </WorkspaceAppShell>
    );

    expect(
      screen.getByRole("navigation", { name: "워크스페이스" })
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("노트 목록");
    expect(screen.getByText("김민수의 워크스페이스")).toBeInTheDocument();
  });
});
