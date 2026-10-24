import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatStarter } from "@/components/chat/chat-starter";
import { messagesFor } from "@/i18n/messages";

const data = vi.hoisted(() => ({
  review: undefined as unknown,
  notes: undefined as unknown,
  projects: undefined as unknown,
  requestNewMeeting: vi.fn(),
  reviewNoteIds: [] as string[],
}));
vi.mock("@/lib/api/generated/meeting-review/meeting-review", () => ({
  useGetMeetingReview: (
    noteId: string,
    options: { query: { enabled: boolean } }
  ) => {
    if (options.query.enabled) data.reviewNoteIds.push(noteId);
    return { data: options.query.enabled ? data.review : undefined };
  },
}));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  useGetProjects: () => ({ data: data.projects }),
}));
vi.mock("@/lib/workspace/use-note-list-pages", () => ({
  useNoteListPages: ({ enabled }: { enabled: boolean }) => ({
    data: enabled ? data.notes : undefined,
    isPlaceholderData: false,
  }),
}));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useRequestNewMeeting: () => data.requestNewMeeting,
}));

const ok = <T,>(payload: T) => ({
  status: 200,
  data: { success: true, data: payload },
});
const note = (noteId: string, title: string, meetingStatus: string) => ({
  noteId,
  title,
  meetingStatus,
});
const reviewWith = (kinds: string[]) =>
  ok({ items: kinds.map((kind) => ({ kind, included: false })) });

function renderStarter(over: Partial<Parameters<typeof ChatStarter>[0]> = {}) {
  const onPick = vi.fn();
  render(
    <NextIntlClientProvider locale="ko" messages={messagesFor("ko")}>
      <ChatStarter
        workspaceId="w"
        context={null}
        disabled={false}
        onPick={onPick}
        {...over}
      />
    </NextIntlClientProvider>
  );
  return onPick;
}

const chips = () =>
  within(screen.getByRole("list", { name: "예시 질문" }))
    .getAllByRole("button")
    .map((button) => button.textContent);

describe("ChatStarter", () => {
  beforeEach(() => {
    data.review = undefined;
    data.notes = undefined;
    data.projects = ok({ projects: [{ projectId: "p1" }] });
    data.reviewNoteIds = [];
    data.requestNewMeeting.mockClear();
  });
  afterEach(cleanup);

  describe("시작한 회의가 없는 처음 사용자", () => {
    beforeEach(() => {
      // 만들기만 하고 시작하지 않은 노트는 물을 내용이 없다 — 처음 사용자로 본다
      data.notes = ok({
        notes: [note("n0", "빈 노트", "NOT_STARTED")],
        hasMore: false,
      });
    });

    it("회의록 전제 칩 없이 웹 찾기·할 일 만들기만 권한다", () => {
      renderStarter();
      expect(chips()).toEqual(["웹에서 찾기", "할 일 만들기"]);
      expect(screen.queryByText(/근거와 함께 찾아 드려요/)).toBeNull();
    });

    it("프로젝트가 없으면 할 일 칩을 뺀다 — 할 일은 프로젝트에 만들어진다", () => {
      data.projects = ok({ projects: [] });
      renderStarter();
      expect(chips()).toEqual(["웹에서 찾기"]);
    });

    it("칩 위에 첫 회의 안내와 [새 회의 기록]이 서고, 누르면 새 회의 창을 연다", () => {
      renderStarter();
      expect(
        screen.getByText("첫 회의를 기록하면 결정과 할 일을 정리해 드려요.")
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "새 회의 기록" }));
      expect(data.requestNewMeeting).toHaveBeenCalledOnce();
    });

    it("칩을 누르면 긴 문장과 상태를 넘긴다 — 보내는 것은 사람이다", () => {
      const onPick = renderStarter();
      fireEvent.click(screen.getByRole("button", { name: "웹에서 찾기" }));
      expect(onPick).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "web",
          state: "first",
          question: "Next.js 최신 버전에서 바뀐 점을 웹에서 찾아줘",
        })
      );
    });
  });

  describe("회의록이 있고 노트 화면 밖", () => {
    beforeEach(() => {
      data.notes = ok({
        notes: [
          note("n9", "아직 안 연 노트", "NOT_STARTED"),
          note("n1", "주간 제품 회의", "ENDED"),
          note("n2", "지난 회의", "ENDED"),
        ],
        hasMore: false,
      });
    });

    it("최근 결정 · 바뀐 결정 · 남은 할 일 · 지난 회의 요약 칩이다", () => {
      renderStarter();
      expect(chips()).toEqual([
        "최근 결정",
        "바뀐 결정",
        "남은 할 일",
        "지난 회의 요약",
      ]);
      expect(screen.getByText(/근거와 함께 찾아 드려요/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "새 회의 기록" })).toBeNull();
    });

    it("지난 회의 요약은 가장 최근 회의 제목을 넣고 그 회의록을 범위로 함께 넘긴다", () => {
      const onPick = renderStarter();
      fireEvent.click(screen.getByRole("button", { name: "지난 회의 요약" }));
      expect(onPick).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "summary",
          state: "workspace",
          question: "「주간 제품 회의」 회의를 요약해줘",
          scope: { kind: "note", id: "n1", title: "주간 제품 회의" },
        })
      );
    });

    it("목록을 아직 모르면 처음 안내를 하지 않고, 요약 칩은 범위 없이 선다", () => {
      data.notes = undefined;
      const onPick = renderStarter();
      expect(screen.queryByText(/첫 회의를 기록하면/)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "지난 회의 요약" }));
      expect(onPick.mock.calls[0][0].scope).toBeUndefined();
    });
  });

  describe("노트 화면에서 열었을 때", () => {
    const context = { noteId: "n1", title: "주간 회의" };

    it("그 회의 기준 칩이고 설명도 그 회의를 말한다 — 목록은 읽지 않는다", () => {
      data.notes = ok({ notes: [], hasMore: false });
      renderStarter({ context });
      expect(chips()).toEqual([
        "이 회의 결정",
        "이 회의 요약",
        "바뀐 결정",
        "웹에서 찾기",
      ]);
      expect(screen.getByText(/「주간 회의」 회의를 보고 답해요/)).toBeTruthy();
      // 빈 목록이어도 처음 안내로 읽지 않는다 — 회의록 안에 있다
      expect(screen.queryByText(/첫 회의를 기록하면/)).toBeNull();
      expect(data.reviewNoteIds).toContain("n1");
    });

    it("검토본에 액션 아이템이 있을 때만 할 일로 만들기 칩이 선다", () => {
      data.review = reviewWith(["DECISION"]);
      renderStarter({ context });
      expect(chips()).not.toContain("할 일로 만들기");
      cleanup();
      data.review = reviewWith(["DECISION", "ACTION_ITEM"]);
      const onPick = renderStarter({ context });
      expect(chips()).toContain("할 일로 만들기");
      fireEvent.click(screen.getByRole("button", { name: "할 일로 만들기" }));
      expect(onPick).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "action_items",
          state: "note",
          question: "이 회의의 액션 아이템을 할 일로 만들어줘",
        })
      );
    });
  });

  it("답을 만드는 중이거나 승인을 기다리는 동안에는 칩을 누를 수 없다", () => {
    const onPick = renderStarter({ disabled: true });
    for (const card of within(
      screen.getByRole("list", { name: "예시 질문" })
    ).getAllByRole("button")) {
      expect((card as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(card);
    }
    expect(onPick).not.toHaveBeenCalled();
  });

  it("★ 연동 안내 줄은 없다(사용자 지시)", () => {
    renderStarter();
    expect(screen.queryByText(/연동하면/)).toBeNull();
    expect(screen.queryByRole("button", { name: "연동하기" })).toBeNull();
  });
});
