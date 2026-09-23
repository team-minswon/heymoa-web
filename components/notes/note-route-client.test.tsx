import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteRouteClient } from "@/components/notes/note-route-client";

const state = vi.hoisted(() => ({
  realtimeNoteIds: [] as string[],
  onNotMember: null as (() => void) | null,
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace }),
}));

vi.mock("@/components/notes/note-realtime-provider", () => ({
  NoteRealtimeProvider: ({
    noteId,
    onNotMember,
    children,
  }: {
    noteId: string;
    onNotMember: () => void;
    children: ReactNode;
  }) => {
    state.realtimeNoteIds.push(noteId);
    state.onNotMember = onNotMember;
    return <div data-testid="note-realtime-provider">{children}</div>;
  },
}));

vi.mock("@/components/notes/note-view", () => ({
  NoteView: ({ noteId }: { noteId: string }) => (
    <div data-testid="note-view">{noteId}</div>
  ),
}));

describe("NoteRouteClient", () => {
  afterEach(() => {
    cleanup();
    state.realtimeNoteIds.length = 0;
    state.onNotMember = null;
    state.replace.mockClear();
  });

  it("노트 화면 수명 동안 해당 noteId의 실시간 구독 provider를 유지한다", () => {
    render(
      <NoteRouteClient
        workspaceId="workspace"
        noteId="note"
        initialQuery={{}}
      />
    );

    expect(screen.getByTestId("note-realtime-provider")).toBeInTheDocument();
    expect(screen.getByTestId("note-view")).toHaveTextContent("note");
    expect(state.realtimeNoteIds).toEqual(["note"]);
    state.onNotMember?.();
    expect(state.replace).toHaveBeenCalledWith("/w/workspace");
  });
});
