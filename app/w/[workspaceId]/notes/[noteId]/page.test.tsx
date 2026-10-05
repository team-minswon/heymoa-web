import { describe, expect, it, vi } from "vitest";

import NoteRoute from "./page";

vi.mock("@/components/notes/note-route-client", () => ({
  NoteRouteClient: () => null,
}));

// 서버 조회가 다시 진입 경로에 들어오면 API가 느린 동안 이전 화면에 머물게 된다.
vi.mock("@/lib/workspace/prefetch", () => ({
  prefetchNoteRoute: () => {
    throw new Error("노트 진입은 서버 조회를 기다리지 않아야 합니다.");
  },
}));

describe("NoteRoute", () => {
  it("서버 데이터 조회 없이 요청한 노트 화면과 탭을 반환한다", async () => {
    const route = await NoteRoute({
      params: Promise.resolve({ workspaceId: "workspace", noteId: "note" }),
      searchParams: Promise.resolve({ view: ["full"], tab: ["transcript"] }),
    });

    expect(route.props).toEqual({
      workspaceId: "workspace",
      noteId: "note",
      initialQuery: { view: "full", tab: "transcript" },
    });
  });
});
