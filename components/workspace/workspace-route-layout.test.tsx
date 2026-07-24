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
    children,
  }: {
    activeNoteId?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="workspace-shell" data-active-note-id={activeNoteId}>
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
  });

  it("keeps the workspace page mounted for a full-screen note (sidebar retained)", () => {
    route.noteId = "note-1";
    route.search = "view=full&tab=transcript";

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div>전체 화면 노트</div>
      </WorkspaceRouteLayout>
    );

    // v5: full 모드도 사이드바를 유지하므로 허브 페이지가 셸 안에 계속 마운트된다.
    expect(screen.getByText("워크스페이스 목록")).toBeInTheDocument();
    expect(screen.getByText("전체 화면 노트")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
      "data-active-note-id",
      "note-1"
    );
  });
});
