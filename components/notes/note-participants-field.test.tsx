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
import type { Participant } from "@/components/notes/note-participants";

const replaceParticipants = vi.hoisted(() => vi.fn());
const replaceGuestParticipants = vi.hoisted(() => vi.fn());
const createGuestParticipant = vi.hoisted(() => vi.fn());
const getNote = vi.hoisted(() => vi.fn());
const savingState = vi.hoisted(() => ({ pending: false }));
const replaceOptions = vi.hoisted(() => [] as unknown[]);
vi.mock("@/lib/api/generated/notes/notes", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNote,
  useReplaceNoteParticipants: (options: unknown) => {
    replaceOptions.push(options);
    return { mutateAsync: replaceParticipants, isPending: savingState.pending };
  },
  useReplaceNoteGuestParticipants: (options: unknown) => {
    replaceOptions.push(options);
    return { mutateAsync: replaceGuestParticipants, isPending: false };
  },
  useCreateNoteGuestParticipant: () => ({
    mutateAsync: createGuestParticipant,
    isPending: false,
  }),
}));

const guestsState = vi.hoisted(() => ({
  failed: false,
  staleFailed: false,
  fetching: false,
  refetch: vi.fn(),
  guests: [] as Array<{
    guestId: string;
    displayName: string;
    noteCount: number;
    createdAt: string;
  }>,
}));
vi.mock(
  "@/lib/api/generated/workspaces/workspaces",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useGetWorkspaceGuests: () => ({
      isPending: false,
      isFetching: guestsState.fetching,
      isError: guestsState.failed || guestsState.staleFailed,
      refetch: guestsState.refetch,
      data: guestsState.failed
        ? undefined
        : {
            status: 200,
            data: { success: true, data: { guests: guestsState.guests } },
          },
    }),
  })
);

const membersState = vi.hoisted(() => ({
  failed: false,
  staleFailed: false,
  fetching: false,
  refetch: vi.fn(),
}));
vi.mock(
  "@/lib/api/generated/workspace-members/workspace-members",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useGetWorkspaceMembers: () => ({
      isPending: false,
      isFetching: membersState.fetching,
      isError: membersState.failed || membersState.staleFailed,
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

const shell = vi.hoisted(() => ({
  openSettings: null as null | ((section: string) => void),
}));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useOpenSettings: () => shell.openSettings,
}));

const PARTICIPANT: Participant = {
  participantId: "01K0000000101",
  userId: "01K0000000001",
  guestId: null,
  name: "김민수",
  email: "minsu@heymoa.com",
  image: null,
};

const GUEST_PARTICIPANT: Participant = {
  participantId: "01K0000000201",
  userId: null,
  guestId: "01K0000000301",
  name: "박서준",
  email: null,
  image: null,
};

function fieldOf(participants: Participant[]) {
  return (
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

function autoOpenField(props: { autoOpen: boolean; onAutoOpened: () => void }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <NoteParticipantsField
        noteId="01K0000000009"
        projectId="01K0000000008"
        workspaceId="01K0000000007"
        participants={[PARTICIPANT]}
        {...props}
      />
    </QueryClientProvider>
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("combobox", { name: /참여자 추가/ }));
}

describe("NoteParticipantsField", () => {
  beforeEach(() => {
    replaceParticipants.mockReset();
    replaceParticipants.mockResolvedValue({ status: 200 });
    replaceGuestParticipants.mockReset();
    replaceGuestParticipants.mockResolvedValue({ status: 200 });
    createGuestParticipant.mockReset();
    createGuestParticipant.mockResolvedValue({ status: 201 });
    getNote.mockReset();
    toastError.mockReset();
    savingState.pending = false;
    membersState.failed = false;
    membersState.refetch.mockReset();
    guestsState.failed = false;
    guestsState.refetch.mockReset();
    guestsState.guests = [
      {
        guestId: "01K0000000301",
        displayName: "박서준",
        noteCount: 1,
        createdAt: "2026-07-08T00:00:00Z",
      },
    ];
  });
  afterEach(cleanup);

  it("열어 달라는 요청이 있으면 선택창을 열고 요청을 거둔다", async () => {
    const onAutoOpened = vi.fn();
    render(autoOpenField({ autoOpen: true, onAutoOpened }));

    expect((await screen.findAllByRole("option")).length).toBeGreaterThan(0);
    expect(onAutoOpened).toHaveBeenCalledTimes(1);
  });

  it("요청이 없으면 선택창을 열지 않는다", () => {
    const onAutoOpened = vi.fn();
    render(autoOpenField({ autoOpen: false, onAutoOpened }));

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(onAutoOpened).not.toHaveBeenCalled();
  });

  it("요청이 거둬진 뒤 다시 그려도 또 열지 않는다", async () => {
    const onAutoOpened = vi.fn();
    const view = render(autoOpenField({ autoOpen: true, onAutoOpened }));
    await screen.findAllByRole("option");
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryAllByRole("option")).toHaveLength(0)
    );

    view.rerender(autoOpenField({ autoOpen: false, onAutoOpened }));
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(onAutoOpened).toHaveBeenCalledTimes(1);
  });

  it("임시 참여자 조회가 실패해도 저장된 임시 참여자를 안 지운다", async () => {
    guestsState.failed = true;
    renderField([PARTICIPANT, GUEST_PARTICIPANT]);
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[items.length - 1]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalled());
    expect(replaceGuestParticipants).not.toHaveBeenCalled();
  });

  it("멤버 조회가 실패해도 저장된 멤버를 안 지운다", async () => {
    membersState.failed = true;
    renderField([PARTICIPANT, GUEST_PARTICIPANT]);
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[items.length - 1]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceGuestParticipants).toHaveBeenCalled());
    expect(replaceParticipants).not.toHaveBeenCalled();
  });

  const DEPARTED: Participant = {
    participantId: "01K0000000109",
    userId: "01K0000000009",
    guestId: null,
    name: "나간사람",
    email: "left@heymoa.com",
    image: null,
  };

  it("워크스페이스를 떠난 참여자도 후보에 선다", async () => {
    renderField([PARTICIPANT, DEPARTED]);
    openMenu();

    const items = await screen.findAllByRole("option");
    const departed = items.find((item) =>
      item.textContent?.includes("나간사람")
    );
    expect(departed).toBeDefined();
    expect(departed).toHaveAttribute("aria-selected", "true");
  });

  it("후보를 다시 읽는 중에도 떠난 참여자가 남는다", async () => {
    membersState.fetching = true;
    guestsState.fetching = true;
    try {
      renderField([PARTICIPANT, DEPARTED]);
      openMenu();

      const items = await screen.findAllByRole("option");
      expect(
        items.find((item) => item.textContent?.includes("나간사람"))
      ).toBeDefined();
    } finally {
      membersState.fetching = false;
      guestsState.fetching = false;
    }
  });

  it("리패치가 실패해도 캐시가 있으면 떠난 참여자가 남는다", async () => {
    membersState.staleFailed = true;
    guestsState.staleFailed = true;
    try {
      renderField([PARTICIPANT, DEPARTED]);
      openMenu();

      const items = await screen.findAllByRole("option");
      expect(
        items.find((item) => item.textContent?.includes("나간사람"))
      ).toBeDefined();
    } finally {
      membersState.staleFailed = false;
      guestsState.staleFailed = false;
    }
  });

  it("리패치가 실패하면 ＋ 추가를 안 연다", async () => {
    membersState.staleFailed = true;
    try {
      renderField([PARTICIPANT]);
      openMenu();
      await screen.findAllByRole("option");
      fireEvent.change(screen.getByLabelText("이름이나 이메일로 참여자 검색"), {
        target: { value: "새로운사람" },
      });

      expect(screen.queryByRole("button", { name: /새로운사람/ })).toBeNull();
    } finally {
      membersState.staleFailed = false;
    }
  });

  it("고르는 사이에 도착한 참여자를 지우지 않는다", async () => {
    const { rerender } = renderField([PARTICIPANT]);
    openMenu();
    await screen.findAllByRole("option");

    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    rerender(fieldOf([PARTICIPANT, GUEST_PARTICIPANT]));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalled());
    const sent = replaceParticipants.mock.calls[0][0].data.userIds as string[];
    expect(sent).toContain("01K0000000001");
    expect(sent).toContain("01K0000000002");
    expect(replaceGuestParticipants).not.toHaveBeenCalled();
  });

  it("떠난 참여자임을 표시한다", async () => {
    renderField([PARTICIPANT, DEPARTED]);
    openMenu();

    await screen.findAllByRole("option");
    expect(screen.getByText("워크스페이스에 없는 사람")).toBeInTheDocument();
  });

  it("떠난 참여자를 뺄 수 있다", async () => {
    renderField([PARTICIPANT, DEPARTED]);
    openMenu();

    const items = await screen.findAllByRole("option");
    const departed = items.find((item) =>
      item.textContent?.includes("나간사람")
    )!;
    fireEvent.click(departed);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() =>
      expect(replaceParticipants).toHaveBeenCalledWith({
        noteId: "01K0000000009",
        data: {
          userIds: [PARTICIPANT.userId],
          expectedUserIds: [PARTICIPANT.userId, DEPARTED.userId],
        },
      })
    );
  });

  it("다른 멤버를 더해도 떠난 참여자를 요청에 함께 싣는다", async () => {
    renderField([PARTICIPANT, DEPARTED]);
    openMenu();

    const items = await screen.findAllByRole("option");
    const other = items.find((item) => item.textContent?.includes("한지원"))!;
    fireEvent.click(other);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalled());
    const sent = replaceParticipants.mock.calls.at(-1)![0].data.userIds;
    expect(sent).toContain(DEPARTED.userId);
  });

  it("참여자가 없으면 빈 상태 문구를 보여준다", () => {
    renderField([]);

    expect(screen.getByText("아직 참여자가 없습니다.")).toBeInTheDocument();
  });

  it("이미 참여자인 멤버가 체크된 채로 열린다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-selected", "true");
    expect(items[items.length - 1]).toHaveAttribute("aria-selected", "false");
  });

  it("고를 때마다 닫지 않아도 바로 저장한다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(
      items.find((item) => item.textContent?.includes("한지원"))!
    );

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(1));
  });

  it("저장이 도는 동안 더 고르면 끝난 뒤 마지막 상태를 이어서 보낸다", async () => {
    let settle: (value: unknown) => void = () => {};
    replaceParticipants.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      })
    );
    renderField([PARTICIPANT]);
    openMenu();
    await screen.findAllByRole("option");

    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    expect(replaceParticipants).toHaveBeenCalledTimes(1);

    settle({ status: 200 });
    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(2));
    expect(replaceParticipants.mock.calls[1][0].data).toEqual({
      userIds: ["01K0000000001"],
      expectedUserIds: ["01K0000000001", "01K0000000002"],
    });
  });

  it("충돌로 병합된 남의 참여자를 대기 중인 다음 저장이 지우지 않는다", async () => {
    let settle: (value: unknown) => void = () => {};
    let settleQueued: (value: unknown) => void = () => {};
    replaceParticipants.mockReset();
    replaceParticipants
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          settle = reject;
        })
      )
      .mockResolvedValueOnce({ status: 200 })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          settleQueued = resolve;
        })
      )
      .mockResolvedValue({ status: 200 });
    getNote.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: { participants: [PARTICIPANT, ADDED_BY_OTHER] },
      },
    });
    renderField([PARTICIPANT]);
    openMenu();
    await screen.findAllByRole("option");

    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    settle({
      success: false,
      data: null,
      error: {
        code: "NOTE_PARTICIPANTS_CONFLICT",
        message: "충돌",
        details: null,
      },
    });

    await waitFor(() =>
      expect(replaceParticipants.mock.calls.length).toBeGreaterThanOrEqual(2)
    );
    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    settleQueued({ status: 200 });
    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(4));
    for (const [call] of replaceParticipants.mock.calls.slice(1)) {
      expect(call.data.userIds).toContain("01K0000000003");
    }
  });

  it("셸 안이면 팝업 맨 아래에서 임시 참여자 설정을 열고 팝업을 닫는다", async () => {
    const openSettings = vi.fn();
    shell.openSettings = openSettings;
    try {
      renderField();
      openMenu();

      const manage = await screen.findByRole("button", {
        name: "임시 참여자 관리",
      });
      const search = screen.getByRole("combobox", { name: /참여자 검색/ });
      expect(
        manage.compareDocumentPosition(search) &
          Node.DOCUMENT_POSITION_PRECEDING
      ).toBeTruthy();

      fireEvent.click(manage);
      expect(openSettings).toHaveBeenCalledWith("guests");
      await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
    } finally {
      shell.openSettings = null;
    }
  });

  it("셸 밖이면 관리 줄을 그리지 않는다", async () => {
    renderField();
    openMenu();

    await screen.findByRole("combobox", { name: /참여자 검색/ });
    expect(
      screen.queryByRole("button", { name: "임시 참여자 관리" })
    ).toBeNull();
  });

  it("열 때 골라져 있던 사람이 위에 선다", async () => {
    renderField([MEMBER_TWO]);
    openMenu();

    const items = await screen.findAllByRole("option");
    expect(items[0]).toHaveTextContent("한지원");
  });

  it("닫을 때 선택한 전체 목록을 한 번에 보낸다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(
      items.find((item) => item.textContent?.includes("한지원"))!
    );
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(1));
    expect(replaceParticipants).toHaveBeenCalledWith({
      noteId: "01K0000000009",
      data: {
        userIds: ["01K0000000001", "01K0000000002"],
        expectedUserIds: ["01K0000000001"],
      },
    });
  });

  it("아무것도 안 건드리고 닫으면 그 사이 바뀐 참여자를 덮어쓰지 않는다", async () => {
    const view = renderField();
    openMenu();
    await screen.findAllByRole("option");

    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <NoteParticipantsField
          noteId="01K0000000009"
          projectId="01K0000000008"
          workspaceId="01K0000000007"
          participants={[
            PARTICIPANT,
            {
              participantId: "01K0000000102",
              userId: "01K0000000002",
              guestId: null,
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

    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
    expect(replaceParticipants).not.toHaveBeenCalled();
  });

  it("고른 것이 그대로면 요청을 보내지 않는다", async () => {
    renderField();
    openMenu();
    await screen.findAllByRole("option");
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
    expect(replaceParticipants).not.toHaveBeenCalled();
  });

  it("멤버를 못 불러오면 다시 시도를 준다", async () => {
    membersState.failed = true;
    renderField();
    openMenu();

    expect(
      await screen.findByRole("button", { name: "다시 시도" })
    ).toBeInTheDocument();
  });

  it("후보에 멤버와 임시 참여자가 이름순으로 섞인다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveTextContent("박서준");
    expect(items[1]).toHaveTextContent("외부");
  });

  it("이미 참여자인 임시 참여자도 체크된 채로 열린다", async () => {
    renderField([PARTICIPANT, GUEST_PARTICIPANT]);
    openMenu();

    const items = await screen.findAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-selected", "true");
    expect(items[1]).toHaveAttribute("aria-selected", "true");
    expect(items[2]).toHaveAttribute("aria-selected", "false");
  });

  it("임시 참여자는 계정 참여자와 다른 요청으로 저장한다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[1]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() =>
      expect(replaceGuestParticipants).toHaveBeenCalledWith({
        noteId: "01K0000000009",
        data: { guestIds: ["01K0000000301"], expectedGuestIds: [] },
      })
    );
    expect(replaceParticipants).not.toHaveBeenCalled();
  });

  it("계정 참여자 저장이 실패해도 임시 참여자 요청은 나간다", async () => {
    replaceParticipants.mockRejectedValue(new Error("boom"));
    renderField([PARTICIPANT, GUEST_PARTICIPANT]);
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[1]);
    fireEvent.click(items[2]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalled());
    await waitFor(() => expect(replaceGuestParticipants).toHaveBeenCalled());
  });

  it("멤버만 바꾸면 임시 참여자 요청은 안 나간다", async () => {
    renderField([PARTICIPANT, GUEST_PARTICIPANT]);
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[2]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(1));
    expect(replaceGuestParticipants).not.toHaveBeenCalled();
  });

  it("조합 중인 한 글자로도 후보가 좁혀진다", async () => {
    renderField();
    openMenu();

    const input = await screen.findByRole("combobox", { name: /참여자 검색/ });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "박" } });

    expect(screen.getByRole("option", { name: /박서준/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /김민수/ })).toBeNull();
  });

  it("정확히 같은 이름을 치면 추가가 안 뜬다", async () => {
    renderField();
    openMenu();

    fireEvent.change(
      await screen.findByRole("combobox", { name: /참여자 검색/ }),
      {
        target: { value: "박서준" },
      }
    );

    expect(screen.queryByRole("button", { name: /추가/ })).toBeNull();
  });

  it("검색창이 외부인을 더할 수 있다고 말한다", async () => {
    renderField();
    openMenu();

    const input = await screen.findByRole("combobox", { name: /참여자 검색/ });
    expect(input).toHaveAttribute(
      "placeholder",
      "이름 검색 또는 임시 참여자 추가"
    );
  });

  it("이름을 치면 추가 버튼 아래에 외부인 설명을 둔다", async () => {
    renderField();
    openMenu();

    fireEvent.change(
      await screen.findByRole("combobox", { name: /참여자 검색/ }),
      {
        target: { value: "새사람" },
      }
    );

    expect(
      screen.getByText("계정 없이 이 회의의 임시 참여자로 추가합니다.")
    ).toBeInTheDocument();
  });

  it("조합 중인 마지막 글자까지 이름에 넣는다", async () => {
    renderField();
    openMenu();

    const input = await screen.findByRole("combobox", { name: /참여자 검색/ });
    fireEvent.input(input, { target: { value: "이민" } });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "이민형" } });

    fireEvent.click(await screen.findByRole("button", { name: /이민형/ }));

    await waitFor(() =>
      expect(createGuestParticipant).toHaveBeenCalledWith({
        noteId: "01K0000000009",
        data: { displayName: "이민형" },
      })
    );
  });

  it("없는 이름을 치면 그 자리에서 임시 참여자를 만든다", async () => {
    renderField();
    openMenu();

    fireEvent.change(
      await screen.findByRole("combobox", { name: /참여자 검색/ }),
      {
        target: { value: "  이도현  " },
      }
    );
    fireEvent.click(await screen.findByRole("button", { name: /이도현/ }));

    await waitFor(() =>
      expect(createGuestParticipant).toHaveBeenCalledWith({
        noteId: "01K0000000009",
        data: { displayName: "이도현" },
      })
    );
  });

  const CONFLICT = {
    success: false,
    data: null,
    error: {
      code: "NOTE_PARTICIPANTS_CONFLICT",
      message:
        "참여자 목록이 그 사이 바뀌었습니다. 다시 읽은 뒤 저장해 주세요.",
      details: null,
    },
  };

  const MEMBER_TWO: Participant = {
    participantId: "01K0000000102",
    userId: "01K0000000002",
    guestId: null,
    name: "한지원",
    email: "jiwon@heymoa.com",
    image: null,
  };

  const ADDED_BY_OTHER: Participant = {
    participantId: "01K0000000103",
    userId: "01K0000000003",
    guestId: null,
    name: "이영희",
    email: "younghee@heymoa.com",
    image: null,
  };

  function latestNote(participants: Participant[]) {
    return { status: 200, data: { success: true, data: { participants } } };
  }

  async function turnOffMemberTwo() {
    openMenu();
    await screen.findAllByRole("option");
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
  }

  it("저장에 병합 기준 목록을 싣는다", async () => {
    renderField([PARTICIPANT, MEMBER_TWO]);
    await turnOffMemberTwo();

    await waitFor(() =>
      expect(replaceParticipants).toHaveBeenCalledWith({
        noteId: "01K0000000009",
        data: {
          userIds: ["01K0000000001"],
          expectedUserIds: ["01K0000000001", "01K0000000002"],
        },
      })
    );
  });

  it("거절되면 최신을 다시 읽어 남이 넣은 사람은 살리고 내가 끈 사람만 빼서 한 번 더 보낸다", async () => {
    replaceParticipants
      .mockRejectedValueOnce(CONFLICT)
      .mockResolvedValueOnce({ status: 200 });
    getNote.mockResolvedValue(
      latestNote([PARTICIPANT, MEMBER_TWO, ADDED_BY_OTHER])
    );
    renderField([PARTICIPANT, MEMBER_TWO]);
    await turnOffMemberTwo();

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(2));
    const retry = replaceParticipants.mock.calls[1][0];
    expect([...retry.data.userIds].sort()).toEqual([
      "01K0000000001",
      "01K0000000003",
    ]);
    expect([...retry.data.expectedUserIds].sort()).toEqual([
      "01K0000000001",
      "01K0000000002",
      "01K0000000003",
    ]);
    expect(toastError).not.toHaveBeenCalled();
    expect(replaceGuestParticipants).not.toHaveBeenCalled();
  });

  it("다시 보낸 것도 거절되면 더 보내지 않고 알린다", async () => {
    replaceParticipants.mockRejectedValue(CONFLICT);
    getNote.mockResolvedValue(
      latestNote([PARTICIPANT, MEMBER_TWO, ADDED_BY_OTHER])
    );
    renderField([PARTICIPANT, MEMBER_TWO]);
    await turnOffMemberTwo();

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith(CONFLICT.error.message);
    expect(replaceParticipants).toHaveBeenCalledTimes(2);
  });

  it("최신을 다시 읽지 못하면 다시 보내지 않고 알린다", async () => {
    replaceParticipants.mockRejectedValue(CONFLICT);
    getNote.mockRejectedValue(new TypeError("Failed to fetch"));
    renderField([PARTICIPANT, MEMBER_TWO]);
    await turnOffMemberTwo();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(CONFLICT.error.message)
    );
    expect(replaceParticipants).toHaveBeenCalledTimes(1);
  });

  it("충돌이 아닌 실패는 다시 보내지 않고 서버 문구로 한 번 알린다", async () => {
    replaceParticipants.mockRejectedValue({
      success: false,
      data: null,
      error: {
        code: "NOT_WORKSPACE_MEMBER",
        message: "워크스페이스 멤버만 참여자로 등록할 수 있습니다.",
        details: null,
      },
    });
    renderField([PARTICIPANT, MEMBER_TWO]);
    await turnOffMemberTwo();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "워크스페이스 멤버만 참여자로 등록할 수 있습니다."
      )
    );
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(replaceOptions).toContainEqual({
      mutation: { meta: { suppressErrorToast: true } },
    });
    expect(replaceParticipants).toHaveBeenCalledTimes(1);
    expect(getNote).not.toHaveBeenCalled();
    expect(screen.getByLabelText("참여자 2명")).toBeInTheDocument();
  });
});
