import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  sortNotesByRecency,
  WorkspaceNoteList,
} from "@/components/workspace/workspace-note-list";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/lib/ui/toast", () => ({ toast }));
// note-list-row는 자체 테스트가 있다 — 목록의 정렬·에러 처리만 본다.
vi.mock("@/components/workspace/note-list-row", () => ({
  NoteListRow: ({
    note,
    now,
  }: {
    note: NoteListResponseDataNotesItem;
    now: number | null;
  }) => (
    <div data-testid="row" data-now={String(now)}>
      {note.title}
    </div>
  ),
}));

/**
 * `meetingStartedAt`이 정렬 키다. `updatedAt`을 일부러 **역순으로** 채워 둔다 — 셋이 같은
 * 값이면 예전의 `updatedAt` 정렬에서도 같은 답이 나와 이 테스트가 회귀를 못 잡는다.
 */
function note(
  noteId: string,
  meetingStartedAt: string | null,
  createdAt = "2026-07-01T00:00:00Z"
): NoteListResponseDataNotesItem {
  return {
    noteId,
    projectId: "01K0000000001",
    title: noteId,
    createdAt,
    updatedAt: "2026-08-09T00:00:00Z",
    lastRecordedAt: null,
    recordedDurationMs: 0,
    activeSessionStartedAt: null,
    meetingStatus: "IN_PROGRESS",
    meetingStartedAt,
    meetingStartedBy: null,
    participants: [],
  };
}

describe("sortNotesByRecency", () => {
  it("기록을 시작한 순서 내림차순으로 세운다", () => {
    const sorted = sortNotesByRecency([
      note("older", "2026-07-10T01:00:00Z"),
      note("newest", "2026-07-11T10:00:00Z"),
      note("middle", "2026-07-11T01:00:00Z"),
    ]);
    expect(sorted.map((n) => n.noteId)).toEqual(["newest", "middle", "older"]);
  });

  it("기록한 적 없는 노트는 만든 시각으로 세운다", () => {
    const sorted = sortNotesByRecency([
      note("recorded", "2026-07-10T01:00:00Z"),
      note("neverRecorded", null, "2026-07-12T00:00:00Z"),
      note("olderThanBoth", null, "2026-07-01T00:00:00Z"),
    ]);
    expect(sorted.map((n) => n.noteId)).toEqual([
      "neverRecorded",
      "recorded",
      "olderThanBoth",
    ]);
  });
});

describe("WorkspaceNoteList", () => {
  beforeEach(() => toast.error.mockReset());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders a flat recency-ordered list", () => {
    render(
      <WorkspaceNoteList
        workspaceId="01K0000000000"
        notes={[
          note("older", "2026-07-10T01:00:00Z"),
          note("newest", "2026-07-11T10:00:00Z"),
        ]}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
        onNewMeeting={vi.fn()}
      />
    );

    const rows = screen.getAllByTestId("row");
    expect(rows.map((r) => r.textContent)).toEqual(["newest", "older"]);
  });

  /**
   * 예전 빈 상태는 "상단바의 **새 노트**로 첫 회의를 시작하면…"이라고 가리키기만 했다.
   * 프로젝트가 없으면 그 버튼이 비활성이라 **가리키는 곳이 눌리지 않았다** — 누를 수 있는
   * 것을 이 자리에 둔다.
   */
  it("회의가 없으면 누를 수 있는 CTA와 다음 단계를 그린다", () => {
    const onNewMeeting = vi.fn();
    render(
      <WorkspaceNoteList
        workspaceId="01K0000000000"
        notes={[]}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
        onNewMeeting={onNewMeeting}
      />
    );

    expect(screen.getByTestId("workspace-onboarding")).toHaveAttribute(
      "data-stage",
      "no-note"
    );
    fireEvent.click(screen.getByRole("button", { name: "새 회의 만들기" }));
    expect(onNewMeeting).toHaveBeenCalledOnce();
  });

  it("keeps load errors out of the page and exposes retry through Sonner", async () => {
    const onRetry = vi.fn();
    render(
      <WorkspaceNoteList
        workspaceId="01K0000000000"
        notes={[]}
        isPending={false}
        isError
        onRetry={onRetry}
        onNewMeeting={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "노트를 불러오지 못했습니다.",
        expect.objectContaining({
          id: "workspace-notes-01K0000000000",
          action: expect.objectContaining({ label: "다시 시도" }),
        })
      )
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const options = toast.error.mock.calls[0][1];
    options.action.onClick();
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("aligns the shared minute clock to the next minute boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T00:00:30.250Z"));
    render(
      <WorkspaceNoteList
        workspaceId="01K0000000000"
        notes={[note("note", "2026-07-11T00:00:00Z")]}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
        onNewMeeting={vi.fn()}
      />
    );
    act(() => vi.advanceTimersByTime(0));

    act(() => vi.advanceTimersByTime(29_750));

    expect(screen.getByTestId("row")).toHaveAttribute(
      "data-now",
      String(Date.parse("2026-07-29T00:01:00Z"))
    );
  });

  it("aligns an active meeting clock to the active session minute boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T00:00:30.250Z"));
    render(
      <WorkspaceNoteList
        workspaceId="01K0000000000"
        notes={[
          {
            ...note("active", "2026-07-29T00:00:00Z"),
            meetingStartedAt: "2026-07-01T00:00:01Z",
            activeSessionStartedAt: "2026-07-29T00:00:01Z",
            meetingStartedBy: {
              userId: "01K0000000099",
              name: "김민수",
              email: "minsu@heymoa.com",
              image: null,
            },
          },
        ]}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
        onNewMeeting={vi.fn()}
      />
    );
    act(() => vi.advanceTimersByTime(0));

    act(() => vi.advanceTimersByTime(30_750));

    expect(screen.getByTestId("row")).toHaveAttribute(
      "data-now",
      String(Date.parse("2026-07-29T00:01:01Z"))
    );
  });

  it("recalculates the shared clock immediately when the page becomes visible", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T00:00:00Z"));
    render(
      <WorkspaceNoteList
        workspaceId="01K0000000000"
        notes={[note("note", "2026-07-11T00:00:00Z")]}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
        onNewMeeting={vi.fn()}
      />
    );
    act(() => vi.advanceTimersByTime(0));
    vi.setSystemTime(new Date("2026-07-29T00:05:00Z"));

    fireEvent(document, new Event("visibilitychange"));

    expect(screen.getByTestId("row")).toHaveAttribute(
      "data-now",
      String(Date.parse("2026-07-29T00:05:00Z"))
    );
  });
});
