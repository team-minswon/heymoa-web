import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceRouteLayout } from "@/components/workspace/workspace-route-layout";

const route = vi.hoisted(() => ({
  noteId: undefined as string | undefined,
  search: "",
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ noteId: route.noteId }),
  useSearchParams: () => new URLSearchParams(route.search),
}));

vi.mock("@/components/workspace/workspace-app-shell", () => ({
  WorkspaceAppShell: ({
    activeNoteId,
    hideSidebar,
    children,
  }: {
    activeNoteId?: string;
    hideSidebar?: boolean;
    children: React.ReactNode;
  }) => (
    <div
      data-testid="workspace-shell"
      data-active-note-id={activeNoteId}
      data-hide-sidebar={String(Boolean(hideSidebar))}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/workspace/workspace-page", () => ({
  WorkspacePage: () => <div>워크스페이스 목록</div>,
}));

describe("WorkspaceRouteLayout", () => {
  afterEach(cleanup);

  beforeEach(() => {
    route.noteId = undefined;
    route.search = "";
  });

  it("keeps the workspace page mounted behind a side note", () => {
    route.noteId = "note-1";
    route.search = "view=side&tab=transcript";

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div>노트 패널</div>
      </WorkspaceRouteLayout>
    );

    expect(screen.getByText("워크스페이스 목록")).toBeInTheDocument();
    expect(screen.getByText("노트 패널")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
      "data-active-note-id",
      "note-1"
    );
    expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
      "data-hide-sidebar",
      "false"
    );
  });

  it("hides the sidebar only for a full-screen note", () => {
    route.noteId = "note-1";
    route.search = "view=full&tab=transcript";

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div>전체 화면 노트</div>
      </WorkspaceRouteLayout>
    );

    expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
      "data-hide-sidebar",
      "true"
    );
  });
});
