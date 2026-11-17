import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeNoteViewQuery, NoteView } from "@/components/notes/note-view";

const state = vi.hoisted(() => ({
  search: "",
  onTabChange: undefined as
    | undefined
    | ((tab: "summary" | "transcript") => void),
  note: undefined as
    | undefined
    | {
        meetingStatus: "IN_PROGRESS" | "PAUSED" | "ENDED";
        meetingStartedBy: null | { userId: string; name: string };
      },
  replace: vi.fn(),
  push: vi.fn(),
}));

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/w/workspace/notes/note",
  useRouter: () => ({ replace: state.replace, push: state.push }),
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock("@/components/chat/personal-chat", () => ({
  usePersonalChatScope: () => {},
}));
vi.mock("@/components/notes/note-panel", () => ({
  NotePanel: ({
    tab,
    onTabChange,
    onSharedTurnActiveChange,
  }: {
    tab: string;
    onTabChange: (
      tab: "summary" | "transcript",
      options?: { push?: boolean }
    ) => void;
    onSharedTurnActiveChange?: (active: boolean) => void;
  }) => {
    state.onTabChange = onTabChange;
    return (
      <>
        <div data-testid="note-panel">{tab}</div>
        <button type="button" onClick={() => onTabChange("summary")}>
          요약 전환
        </button>
        <button
          type="button"
          onClick={() => onTabChange("transcript", { push: true })}
        >
          근거 점프
        </button>
        <button type="button" onClick={() => onSharedTurnActiveChange?.(true)}>
          공유 턴 시작
        </button>
        <button type="button" onClick={() => onSharedTurnActiveChange?.(false)}>
          공유 턴 끝
        </button>
      </>
    );
  },
}));
vi.mock("@/components/notes/note-route-surface", () => ({
  NoteRouteSurface: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  useGetNote: () => ({
    isPending: state.note === undefined,
    data:
      state.note === undefined
        ? undefined
        : {
            status: 200,
            data: { success: true, data: state.note },
          },
  }),
}));

describe("normalizeNoteViewQuery", () => {
  it("falls back to full details", () => {
    expect(
      normalizeNoteViewQuery({ view: "invalid", tab: "invalid" }, "unknown")
    ).toEqual({
      view: "full",
      tab: "details",
    });
  });

  it("preserves the existing full tab contract", () => {
    expect(
      normalizeNoteViewQuery({ view: "full", tab: "summary" }, "active")
    ).toEqual({ view: "full", tab: "summary" });
    expect(
      normalizeNoteViewQuery({ view: "full", tab: "chat" }, "ended")
    ).toEqual({ view: "full", tab: "details" });
    expect(
      normalizeNoteViewQuery({ view: "full", tab: "transcript" }, "ended")
    ).toEqual({ view: "full", tab: "transcript" });
  });

  it("preserves an explicit side details view", () => {
    expect(
      normalizeNoteViewQuery({ view: "side", tab: "details" }, "active")
    ).toEqual({
      view: "side",
      tab: "details",
    });
  });

  it.each([
    ["active", "summary", "details"],
    ["ended", "summary", "summary"],
    ["active", "chat", "details"],
    ["paused", "chat", "details"],
    ["ended", "chat", "details"],
    ["not-started", "chat", "details"],
    ["not-started", "summary", "details"],
  ] as const)(
    "normalizes side %s tab %s to %s",
    (phase, requested, expected) => {
      expect(
        normalizeNoteViewQuery({ view: "side", tab: requested }, phase)
      ).toEqual({ view: "side", tab: expected });
    }
  );

  it("preserves a potentially legal side summary query while the phase is unknown", () => {
    expect(
      normalizeNoteViewQuery({ view: "side", tab: "summary" }, "unknown")
    ).toEqual({ view: "side", tab: "summary" });
  });
});

describe("NoteView", () => {
  const replaceState = vi.fn();
  const pushState = vi.fn();

  beforeEach(() => {
    state.search = "";
    state.note = undefined;
    state.replace.mockReset();
    state.push.mockReset();
    replaceState.mockReset();
    pushState.mockReset();
    vi.spyOn(window.history, "replaceState").mockImplementation(replaceState);
    vi.spyOn(window.history, "pushState").mockImplementation(pushState);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  function replacedUrls() {
    return replaceState.mock.calls.map((call) => call[2]);
  }

  it("근거 점프는 뒤로가기 자리를 남긴다", () => {
    state.search = "view=full&tab=summary";
    render(<NoteView workspaceId="w1" noteId="n1" initialQuery={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "근거 점프" }));

    expect(pushState.mock.calls.map((call) => call[2])).toEqual([
      "/w/workspace/notes/note?view=full&tab=transcript",
    ]);
  });

  it("탭 클릭은 뒤로가기 자리를 남기지 않는다", () => {
    state.search = "view=full&tab=transcript";
    render(<NoteView workspaceId="w1" noteId="n1" initialQuery={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "요약 전환" }));

    expect(pushState).not.toHaveBeenCalled();
    expect(replacedUrls()).toContain(
      "/w/workspace/notes/note?view=full&tab=summary"
    );
  });

  it("announces a meeting state change once through one polite live region", () => {
    state.note = {
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "starter", name: "시작자" },
    };
    const view = render(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    const announcement = screen.getByRole("status", {
      name: "회의 상태 변경",
    });
    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(announcement).toHaveTextContent(
      "회의 상태가 바뀌었습니다: 기록 중"
    );

    state.note = {
      meetingStatus: "ENDED",
      meetingStartedBy: { userId: "starter", name: "시작자" },
    };
    view.rerender(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    expect(
      screen.getAllByRole("status", { name: "회의 상태 변경" })
    ).toHaveLength(1);
    expect(announcement).toHaveTextContent(
      "회의 상태가 바뀌었습니다: 종료됨"
    );
  });

  it("waits for the phase before replacing a potentially legal side query", async () => {
    state.search = "view=side&tab=summary";
    const view = render(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    expect(screen.getByTestId("note-panel").textContent).toBe("summary");
    expect(replacedUrls()).toEqual([]);

    state.note = {
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "starter", name: "시작자" },
    };
    view.rerender(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    expect(screen.getByTestId("note-panel").textContent).toBe("details");
    await waitFor(() =>
      expect(replacedUrls()).toContain(
        "/w/workspace/notes/note?view=side&tab=details"
      )
    );
    expect(state.replace).not.toHaveBeenCalled();
  });

  it("ignores a late summary callback after leaving the note", () => {
    const view = render(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );
    const onTabChange = state.onTabChange!;
    view.unmount();
    onTabChange("summary");
    expect(replacedUrls()).toEqual([]);
  });

  it("ignores the previous note's late summary callback when the view is reused", () => {
    const view = render(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );
    const onTabChange = state.onTabChange!;
    view.rerender(
      <NoteView workspaceId="workspace" noteId="other-note" initialQuery={{}} />
    );
    onTabChange("summary");
    expect(replacedUrls()).toEqual([]);
  });

  it("does not normalize an ended-summary intent from a stale chat URL", async () => {
    state.search = "view=side&tab=chat";
    state.note = {
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "starter", name: "시작자" },
    };
    const view = render(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );
    expect(replacedUrls()).toEqual([
      "/w/workspace/notes/note?view=side&tab=details",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "요약 전환" }));
    expect(replacedUrls()).toEqual([
      "/w/workspace/notes/note?view=side&tab=details",
      "/w/workspace/notes/note?view=side&tab=summary",
    ]);

    state.note = {
      meetingStatus: "ENDED",
      meetingStartedBy: { userId: "starter", name: "시작자" },
    };
    view.rerender(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    await waitFor(() => expect(replacedUrls()).toHaveLength(2));

    state.search = "view=side&tab=summary";
    view.rerender(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );
    await waitFor(() => expect(replacedUrls()).toHaveLength(2));
  });

  describe("메일 링크로 도착", () => {
    afterEach(() => track.mockReset());

    it("메일 진입을 한 번만 세고 노트 id·제목은 싣지 않는다", () => {
      state.note = { meetingStatus: "PAUSED", meetingStartedBy: null };
      const view = render(
        <NoteView
          workspaceId="workspace"
          noteId="note"
          initialQuery={{ source: "mail" }}
        />
      );
      view.rerender(
        <NoteView
          workspaceId="workspace"
          noteId="note"
          initialQuery={{ source: "mail" }}
        />
      );
      expect(track.mock.calls).toEqual([
        [
          "note_opened",
          { workspace_id: "workspace", view: "full", source: "mail" },
        ],
      ]);
    });

    it("목록에서 연 노트는 진입에서 다시 세지 않는다", () => {
      render(
        <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
      );
      expect(track).not.toHaveBeenCalled();
    });

    it("그새 끝난 회의면 도착할 때 요약 탭으로 보낸다", async () => {
      state.search = "view=full&tab=details";
      state.note = { meetingStatus: "ENDED", meetingStartedBy: null };
      render(
        <NoteView
          workspaceId="workspace"
          noteId="note"
          initialQuery={{ source: "mail" }}
        />
      );
      await waitFor(() =>
        expect(replacedUrls()).toContain(
          "/w/workspace/notes/note?view=full&tab=summary"
        )
      );
    });
  });
});
