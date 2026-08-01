import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceRouteLayout } from "@/components/workspace/workspace-route-layout";

const route = vi.hoisted(() => ({
  noteId: undefined as string | undefined,
  search: "",
}));

const segments = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({
  useParams: () => ({ noteId: route.noteId }),
  useSearchParams: () => new URLSearchParams(route.search),
  usePathname: () => "/w/01K0000000000",
  useSelectedLayoutSegments: () => segments,
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

  // 액션 아이템·프로젝트 타임라인은 목록을 대체한다. 같이 그리면 표가 둘 겹친다.
  it("액션 아이템 세그먼트에서는 회의 목록을 그리지 않는다", () => {
    segments.length = 0;
    segments.push("action-items");
    render(
      <WorkspaceRouteLayout workspaceId="01K0000000000">
        <p>액션 아이템 내용</p>
      </WorkspaceRouteLayout>
    );

    expect(screen.getByText("액션 아이템 내용")).toBeInTheDocument();
    expect(screen.queryByText("워크스페이스 목록")).toBeNull();
    segments.length = 0;
  });
});
