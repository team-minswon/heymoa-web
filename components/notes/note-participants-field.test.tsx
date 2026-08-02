import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteParticipantsField } from "@/components/notes/note-participants-field";

const replaceParticipants = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/generated/notes/notes", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useReplaceNoteParticipants: () => ({
    mutateAsync: replaceParticipants,
    isPending: false,
  }),
}));

const membersState = vi.hoisted(() => ({ failed: false, refetch: vi.fn() }));
vi.mock(
  "@/lib/api/generated/workspace-members/workspace-members",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useGetWorkspaceMembers: () => ({
      isPending: false,
      refetch: membersState.refetch,
      data: membersState.failed
        ? { status: 500, data: { success: false } }
        : {
            status: 200,
            data: {
              success: true,
              data: {
                members: [
                  {
                    userId: "01K0000000001",
                    name: "김민수",
                    email: "minsu@heymoa.com",
                    image: null,
                    role: "ADMIN",
                    joinedAt: "2026-07-01T00:00:00Z",
                  },
                  {
                    userId: "01K0000000002",
                    name: "한지원",
                    email: "jiwon@heymoa.com",
                    image: null,
                    role: "MEMBER",
                    joinedAt: "2026-07-02T00:00:00Z",
                  },
                ],
              },
            },
          },
    }),
  })
);

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({ toast: { error: toastError } }));

const PARTICIPANT = {
  userId: "01K0000000001",
  name: "김민수",
  email: "minsu@heymoa.com",
  image: null,
};

function renderField(participants = [PARTICIPANT]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NoteParticipantsField
        noteId="01K0000000009"
        projectId="01K0000000008"
        workspaceId="01K0000000007"
        participants={participants}
      />
    </QueryClientProvider>
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("combobox", { name: /참여자 선택/ }));
}

describe("NoteParticipantsField", () => {
  beforeEach(() => {
    replaceParticipants.mockReset();
    replaceParticipants.mockResolvedValue({ status: 200 });
    toastError.mockReset();
    membersState.failed = false;
    membersState.refetch.mockReset();
  });
  afterEach(cleanup);

  it("참여자가 없으면 빈 상태 문구를 보여준다", () => {
    renderField([]);

    expect(screen.getByText("아직 참여자가 없습니다.")).toBeInTheDocument();
  });

  it("이미 참여자인 멤버가 체크된 채로 열린다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-selected", "true");
    expect(items[1]).toHaveAttribute("aria-selected", "false");
  });

  // 체크마다 보내면 요청이 줄줄이 나가고 응답 순서도 보장되지 않는다.
  it("고르는 동안에는 저장하지 않는다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[1]);

    expect(replaceParticipants).not.toHaveBeenCalled();
  });

  it("닫을 때 선택한 전체 목록을 한 번에 보낸다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[1]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(1));
    expect(replaceParticipants).toHaveBeenCalledWith({
      noteId: "01K0000000009",
      data: { userIds: ["01K0000000001", "01K0000000002"] },
    });
  });

  // 열어만 두고 닫는 사이 폴링이 다른 사람의 변경을 가져오면, 아무것도 안 건드린 사용자가
  // 열던 시점의 목록으로 그 변경을 되돌리게 된다.
  it("아무것도 안 건드리고 닫으면 그 사이 바뀐 참여자를 덮어쓰지 않는다", async () => {
    const view = renderField();
    openMenu();
    await screen.findAllByRole("option");

    // 메뉴가 열려 있는 동안 다른 사용자가 한지원을 추가했다.
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <NoteParticipantsField
          noteId="01K0000000009"
          projectId="01K0000000008"
          workspaceId="01K0000000007"
          participants={[
            PARTICIPANT,
            {
              userId: "01K0000000002",
              name: "한지원",
              email: "jiwon@heymoa.com",
              image: null,
            },
          ]}
        />
      </QueryClientProvider>
    );
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() =>
      expect(screen.queryByRole("option")).toBeNull()
    );
    expect(replaceParticipants).not.toHaveBeenCalled();
  });

  it("고른 것이 그대로면 요청을 보내지 않는다", async () => {
    renderField();
    openMenu();
    await screen.findAllByRole("option");
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() =>
      expect(screen.queryByRole("option")).toBeNull()
    );
    expect(replaceParticipants).not.toHaveBeenCalled();
  });

  // `apiFetch`가 비-2xx 봉투를 throw하고, 문구는 전역 `MutationCache.onError`가 띄운다.
  // 여기서 또 띄우면 두 개가 겹치므로, 이 컴포넌트는 실패를 삼키기만 해야 한다.
  it("저장이 실패해도 자기 토스트를 띄우지 않는다", async () => {
    replaceParticipants.mockRejectedValue({
      success: false,
      data: null,
      error: {
        code: "NOT_WORKSPACE_MEMBER",
        message: "워크스페이스 멤버만 참여자로 등록할 수 있습니다.",
      },
    });
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[1]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
    // 실패했으니 화면은 서버가 준 기존 참여자 그대로 남는다.
    expect(screen.getByLabelText("참여자 1명")).toBeInTheDocument();
  });

  it("멤버를 못 불러오면 다시 시도를 준다", async () => {
    membersState.failed = true;
    renderField();
    openMenu();

    expect(
      await screen.findByRole("button", { name: "다시 시도" })
    ).toBeInTheDocument();
  });
});
