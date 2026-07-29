import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteRouteClient } from "@/components/notes/note-route-client";

const state = vi.hoisted(() => ({
  realtimeNoteIds: [] as string[],
}));

vi.mock("@/components/notes/note-realtime-provider", () => ({
  NoteRealtimeProvider: ({
    noteId,
    children,
  }: {
    noteId: string;
    children: ReactNode;
  }) => {
    state.realtimeNoteIds.push(noteId);
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
  });
});
