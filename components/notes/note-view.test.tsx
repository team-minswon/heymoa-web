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
  note: undefined as
    | undefined
    | {
        meetingStatus: "IN_PROGRESS" | "PAUSED" | "ENDED";
        meetingStartedBy: null | { userId: string; name: string };
      },
  replace: vi.fn(),
  push: vi.fn(),
}));

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
  }) => (
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
  ),
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
  // 기본 탭은 정보다 — 회의를 열면 제목·참여자·시각이 먼저 보인다.
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
    ["active", "chat", "details"],
    ["active", "summary", "details"],
    ["paused", "chat", "details"],
    ["ended", "summary", "summary"],
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

  it.each(["summary"] as const)(
    "preserves a potentially legal side %s query while the phase is unknown",
    (tab) => {
      expect(normalizeNoteViewQuery({ view: "side", tab }, "unknown")).toEqual({
        view: "side",
        tab,
      });
    }
  );
});

describe("NoteView", () => {
  // `view`·`tab`은 라우터를 안 거치고 `window.history.replaceState`로 쓴다 — 그래야
  // Next가 탭 클릭을 내비게이션으로 취급하지 않는다. 그래서 여기를 감시한다.
  // `state.replace`(라우터)는 노트 삭제 후 목록으로 나가는 진짜 이동에만 남아 있다.
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

  /** 라우터를 안 탄 채 쓰인 URL만 뽑는다. */
  function replacedUrls() {
    return replaceState.mock.calls.map((call) => call[2]);
  }

  /**
   * 근거를 눌러 전사로 건너뛴 뒤 뒤로가기를 누르면 **읽던 요약에 돌아와야 한다.**
   * `replaceState`로 쓰면 항목이 안 쌓여 뒤로가기가 노트 진입 이전으로 나가고 노트가 닫힌다.
   */
  it("근거 점프는 뒤로가기 자리를 남긴다", () => {
    state.search = "view=full&tab=summary";
    render(<NoteView workspaceId="w1" noteId="n1" initialQuery={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "근거 점프" }));

    expect(pushState.mock.calls.map((call) => call[2])).toEqual([
      "/w/workspace/notes/note?view=full&tab=transcript",
    ]);
  });

  // 탭마다 항목을 쌓으면 다섯 번 누른 사람이 나가는 데 다섯 번을 눌러야 한다.
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
      "회의 상태가 기록 중으로 변경되었습니다."
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
      "회의 상태가 종료됨으로 변경되었습니다."
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

  it("does not normalize an ended-summary intent from a stale chat URL", async () => {
    state.search = "view=side&tab=chat";
    state.note = {
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "starter", name: "시작자" },
    };
    const view = render(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    fireEvent.click(screen.getByRole("button", { name: "요약 전환" }));
    expect(replacedUrls()).toEqual([
      "/w/workspace/notes/note?view=side&tab=summary",
    ]);

    state.note = {
      meetingStatus: "ENDED",
      meetingStartedBy: { userId: "starter", name: "시작자" },
    };
    view.rerender(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    await waitFor(() => expect(replacedUrls()).toHaveLength(1));

    state.search = "view=side&tab=summary";
    view.rerender(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );
    await waitFor(() => expect(replacedUrls()).toHaveLength(1));
  });

  it("제거된 side chat URL은 정보 탭으로 바로 정규화한다", async () => {
    state.search = "view=side&tab=chat";
    state.note = {
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "starter", name: "시작자" },
    };
    render(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    expect(screen.getByTestId("note-panel")).toHaveTextContent("details");
    await waitFor(() =>
      expect(replacedUrls()).toContain(
        "/w/workspace/notes/note?view=side&tab=details"
      )
    );
    expect(state.replace).not.toHaveBeenCalled();
  });
});
