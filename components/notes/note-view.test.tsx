import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeNoteViewQuery, NoteView } from "@/components/notes/note-view";

const state = vi.hoisted(() => ({
  search: "",
  note: undefined as
    | undefined
    | {
        meetingStatus: "IN_PROGRESS" | "ENDED";
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
  NotePanel: ({ tab }: { tab: string }) => (
    <div data-testid="note-panel">{tab}</div>
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
  it("falls back to full transcript", () => {
    expect(
      normalizeNoteViewQuery({ view: "invalid", tab: "invalid" }, "unknown")
    ).toEqual({
      view: "full",
      tab: "transcript",
    });
  });

  it("preserves the existing full tab contract", () => {
    expect(
      normalizeNoteViewQuery({ view: "full", tab: "summary" }, "active")
    ).toEqual({ view: "full", tab: "summary" });
    expect(
      normalizeNoteViewQuery({ view: "full", tab: "chat" }, "ended")
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
    ["active", "chat", "chat"],
    ["active", "summary", "transcript"],
    ["ended", "summary", "summary"],
    ["ended", "chat", "transcript"],
    ["not-started", "chat", "transcript"],
    ["not-started", "summary", "transcript"],
  ] as const)(
    "normalizes side %s tab %s to %s",
    (phase, requested, expected) => {
      expect(
        normalizeNoteViewQuery({ view: "side", tab: requested }, phase)
      ).toEqual({ view: "side", tab: expected });
    }
  );

  it.each(["chat", "summary"] as const)(
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
  beforeEach(() => {
    state.search = "";
    state.note = undefined;
    state.replace.mockReset();
    state.push.mockReset();
  });
  afterEach(cleanup);

  it("waits for the phase before replacing a potentially legal side query", async () => {
    state.search = "view=side&tab=summary";
    const view = render(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    expect(screen.getByTestId("note-panel").textContent).toBe("summary");
    expect(state.replace).not.toHaveBeenCalled();

    state.note = {
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "starter", name: "시작자" },
    };
    view.rerender(
      <NoteView workspaceId="workspace" noteId="note" initialQuery={{}} />
    );

    expect(screen.getByTestId("note-panel").textContent).toBe("transcript");
    await waitFor(() =>
      expect(state.replace).toHaveBeenCalledWith(
        "/w/workspace/notes/note?view=side&tab=transcript",
        { scroll: false }
      )
    );
  });
});
