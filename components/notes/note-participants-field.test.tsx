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
vi.mock("@/lib/api/generated/notes/notes", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useReplaceNoteParticipants: () => ({
    mutateAsync: replaceParticipants,
    isPending: false,
  }),
  useReplaceNoteGuestParticipants: () => ({
    mutateAsync: replaceGuestParticipants,
    isPending: false,
  }),
  useCreateNoteGuestParticipant: () => ({
    mutateAsync: createGuestParticipant,
    isPending: false,
  }),
}));

const guestsState = vi.hoisted(() => ({
  failed: false,
  /** **캐시를 든 채 리패치만 실패한 상태.** `data` 는 살아 있고 `isError` 만 참이다. */
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
vi.mock("@/lib/api/generated/workspaces/workspaces", async (importOriginal) => ({
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
}));

const membersState = vi.hoisted(() => ({
  failed: false,
  /** 위와 같다 — 캐시를 든 채 리패치만 실패. */
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
      // **캐시를 든 리패치**를 흉내 낸다. TanStack 은 이때 isPending=false, isFetching=true 다
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

const PARTICIPANT: Participant = {
  participantId: "01K0000000101",
  userId: "01K0000000001",
  guestId: null,
  name: "김민수",
  email: "minsu@heymoa.com",
  image: null,
};

/** 계정 없는 참여자. 저장할 때 계정 참여자와 **다른 요청**에 실려야 한다. */
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

function openMenu() {
  fireEvent.click(screen.getByRole("combobox", { name: /참여자 선택/ }));
}

describe("NoteParticipantsField", () => {
  beforeEach(() => {
    replaceParticipants.mockReset();
    replaceParticipants.mockResolvedValue({ status: 200 });
    replaceGuestParticipants.mockReset();
    replaceGuestParticipants.mockResolvedValue({ status: 200 });
    createGuestParticipant.mockReset();
    createGuestParticipant.mockResolvedValue({ status: 201 });
    toastError.mockReset();
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

  /**
   * **저장된 것을 조회 실패로 지우면 안 된다.**
   *
   * 후보 목록은 조회가 실패한 쪽을 빈 배열로 접는다. 목록 컴포넌트가 「고른 것」을 후보에서만
   * 골라 돌려주므로, 그 값으로 draft 를 통째로 다시 만들면 임시 참여자가 사라진 채 전체 교체가
   * 나간다 — 참여자와 **거기 붙은 화자 연결까지** 함께 지워진다.
   */
  it("임시 참여자 조회가 실패해도 저장된 임시 참여자를 안 지운다", async () => {
    guestsState.failed = true;
    renderField([PARTICIPANT, GUEST_PARTICIPANT]);
    openMenu();

    // 임시 참여자는 후보에 못 서지만, 멤버는 그대로 고를 수 있다
    const items = await screen.findAllByRole("option");
    fireEvent.click(items[items.length - 1]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    // 계정 쪽만 바뀌고 임시 참여자는 그대로여야 한다 — 안 바뀌었으므로 요청 자체가 없다
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

  // ── 워크스페이스를 떠난 참여자 ────────────────────────────────────────────

  /** 계정은 있는데 더는 멤버가 아닌 사람. 내보내도 참여 기록은 남는다. */
  const DEPARTED: Participant = {
    participantId: "01K0000000109",
    userId: "01K0000000009",
    guestId: null,
    name: "나간사람",
    email: "left@heymoa.com",
    image: null,
  };

  /**
   * **후보를 멤버·게스트로만 세우면 이 사람이 화면에서 사라진다.** 그러면 뺄 수도 없고,
   * 전체 교체라 다른 멤버를 더하는 저장에 이 사람을 안 실어 조용히 함께 지워진다.
   */
  it("워크스페이스를 떠난 참여자도 후보에 선다", async () => {
    renderField([PARTICIPANT, DEPARTED]);
    openMenu();

    const items = await screen.findAllByRole("option");
    const departed = items.find((item) => item.textContent?.includes("나간사람"));
    expect(departed).toBeDefined();
    expect(departed).toHaveAttribute("aria-selected", "true");
  });

  /**
   * **리패치는 그리기를 막지 않는다.**
   *
   * 캐시를 든 리패치(`isPending=false, isFetching=true`)를 「아직 못 읽었다」로 읽으면 떠난
   * 참여자가 후보에서 사라져 **그 사이 해제할 수 없다.** 만들기 판정에는 `isFetching` 이
   * 들어가야 하고 그리기 판정에는 들어가면 안 된다 — 한 변수로 겸용하다 실제로 깨졌다.
   */
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

  /**
   * **캐시를 든 채 리패치만 실패한 상태.** `data` 는 살아 있고 `isError` 만 참이다.
   *
   * 이것을 「못 읽었다」로 읽으면 떠난 참여자가 사라져 해제할 수 없다. 「들고 있나」와
   * 「지금 최신인가」를 한 변수로 겸용하다 두 번 깨진 자리다 — 그리기는 들고 있는 것으로 한다.
   */
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

  /** 반대쪽 — 그 상태에서 **만들기**는 닫혀야 한다. 낡은 캐시로 동명이인이 생긴다. */
  it("리패치가 실패하면 ＋ 추가를 안 연다", async () => {
    membersState.staleFailed = true;
    try {
      renderField([PARTICIPANT]);
      openMenu();
      await screen.findAllByRole("option");
      fireEvent.change(screen.getByLabelText("이름이나 이메일로 참여자 검색"), {
        target: { value: "새로운사람" },
      });

      expect(screen.queryByText(/추가/)).toBeNull();
    } finally {
      membersState.staleFailed = false;
    }
  });

  /**
   * **여는 동안 남이 넣은 사람을 지우지 않는다.**
   *
   * 메뉴를 열 때 최신을 당기는데, 그 응답이 도착하기 전에 사람이 하나를 고르면 draft 가
   * 옛 목록으로 굳는다. 그대로 전체 교체로 보내면 **그 사이 도착한 참여자와 그의 화자 연결이
   * 지워진다** — 최신을 당기려던 것이 남의 것을 지우는 길이 된다. 사람이 한 것은 「무엇을
   * 켰고 껐나」지 「목록이 이것이다」가 아니다.
   */
  it("고르는 사이에 도착한 참여자를 지우지 않는다", async () => {
    const { rerender } = renderField([PARTICIPANT]);
    openMenu();
    await screen.findAllByRole("option");

    // 사람이 한지원을 켠다 — 이 순간 draft 는 [김민수, 한지원] 으로 굳는다
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    // 그 사이 남이 넣은 박서준이 도착한다
    rerender(fieldOf([PARTICIPANT, GUEST_PARTICIPANT]));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    // 계정 참여자 요청에 한지원이 더해지고 김민수가 남는다
    await waitFor(() => expect(replaceParticipants).toHaveBeenCalled());
    const sent = replaceParticipants.mock.calls[0][0].data.userIds as string[];
    expect(sent).toContain("01K0000000001");
    expect(sent).toContain("01K0000000002");
    // **임시 참여자 요청이 아예 안 나가야 한다.** 박서준을 켠 적도 끈 적도 없으니 그쪽은
    // 바뀐 것이 없다. 병합이 없으면 draft 에 그가 없어 `guestIds: []` 가 나가고 **그와 그의
    // 화자 연결이 지워진다.**
    expect(replaceGuestParticipants).not.toHaveBeenCalled();
  });

  /**
   * **반대 방향이다.** 남이 **뺀** 사람을 되살리지 않는다. 스냅샷에서 출발해 병합하면
   * `next` 안에 아직 그가 있어 다시 들어가는데, 그의 화자 연결은 이미 지워졌으므로
   * **이름만 돌아오고 연결은 안 돌아온다.** 사람이 한 것은 켠 것과 끈 것뿐이다.
   */
  it("고르는 사이에 남이 뺀 참여자를 되살리지 않는다", async () => {
    const { rerender } = renderField([PARTICIPANT]);
    openMenu();
    await screen.findAllByRole("option");

    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    // 그 사이 남이 김민수를 뺐다
    rerender(fieldOf([]));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalled());
    const sent = replaceParticipants.mock.calls[0][0].data.userIds as string[];
    expect(sent).toContain("01K0000000002");
    expect(sent).not.toContain("01K0000000001");
  });

  /** 멤버 목록에 없는 사람이 왜 있는지 안 보이면 잘못 남은 것으로 읽고 지운다. */
  it("떠난 참여자임을 표시한다", async () => {
    renderField([PARTICIPANT, DEPARTED]);
    openMenu();

    await screen.findAllByRole("option");
    expect(screen.getByText("워크스페이스에 없음")).toBeInTheDocument();
  });

  it("떠난 참여자를 뺄 수 있다", async () => {
    renderField([PARTICIPANT, DEPARTED]);
    openMenu();

    const items = await screen.findAllByRole("option");
    const departed = items.find((item) => item.textContent?.includes("나간사람"))!;
    fireEvent.click(departed);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() =>
      expect(replaceParticipants).toHaveBeenCalledWith({
        noteId: "01K0000000009",
        data: { userIds: [PARTICIPANT.userId] },
      })
    );
  });

  /** 전체 교체라 남길 사람도 요청에 실어야 한다 — 안 실으면 조용히 지워진다. */
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

  // 체크마다 보내면 요청이 줄줄이 나가고 응답 순서도 보장되지 않는다.
  it("고르는 동안에는 저장하지 않는다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items.find((item) => item.textContent?.includes("한지원"))!);

    expect(replaceParticipants).not.toHaveBeenCalled();
  });

  it("닫을 때 선택한 전체 목록을 한 번에 보낸다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items.find((item) => item.textContent?.includes("한지원"))!);
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
    fireEvent.click(items.find((item) => item.textContent?.includes("한지원"))!);
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

  it("후보에 멤버와 임시 참여자가 이름순으로 섞인다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    // 김민수 · 박서준(외부) · 한지원
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

  /**
   * **한 요청에 섞으면 안 된다.** 서버에서 계정 참여자 전체 교체는 임시 참여자를 안 건드리게
   * 뜻이 좁아졌고, 섞어 보내면 그 요청이 400으로 막히거나 조용히 무시된다.
   */
  it("임시 참여자는 계정 참여자와 다른 요청으로 저장한다", async () => {
    renderField();
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[1]); // 박서준(외부)
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() =>
      expect(replaceGuestParticipants).toHaveBeenCalledWith({
        noteId: "01K0000000009",
        data: { guestIds: ["01K0000000301"] },
      })
    );
    // 계정 참여자는 안 바뀌었으니 그쪽 요청은 아예 안 나간다.
    expect(replaceParticipants).not.toHaveBeenCalled();
  });

  /**
   * **둘은 서로 독립인 요청이다.** 이어 붙이면 앞이 실패했을 때 뒤를 아예 안 보내는데,
   * 사람은 한 번의 저장으로 둘을 다 바꿨고 토스트는 하나만 뜬다 — 임시 참여자 변경은
   * 시도조차 안 된 채 조용히 사라진다.
   */
  it("계정 참여자 저장이 실패해도 임시 참여자 요청은 나간다", async () => {
    replaceParticipants.mockRejectedValue(new Error("boom"));
    renderField([PARTICIPANT, GUEST_PARTICIPANT]);
    openMenu();

    const items = await screen.findAllByRole("option");
    fireEvent.click(items[1]); // 박서준(외부) 해제
    fireEvent.click(items[2]); // 한지원 추가
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
    fireEvent.click(items[2]); // 한지원 추가
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => expect(replaceParticipants).toHaveBeenCalledTimes(1));
    expect(replaceGuestParticipants).not.toHaveBeenCalled();
  });

  /** 화자 메뉴와 같은 자리다 — 한글은 한 글자가 곧 조합이라 목록이 안 좁혀졌다. */
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

    fireEvent.change(await screen.findByRole("combobox", { name: /참여자 검색/ }), {
      target: { value: "박서준" },
    });

    expect(screen.queryByRole("button", { name: /추가/ })).toBeNull();
  });

  /**
   * **조합 중인 마지막 글자가 빠지면 안 된다.** 「이민형」을 치면 「형」이 아직 조합 중이라
   * base-ui 의 값은 「이민」에 머문다 — 그대로 쓰면 「이민」이라는 사람이 만들어진다.
   * 화자 지정 메뉴(`speaker-assign-menu`)와 같은 자리이고 같은 방식으로 고쳤다.
   */
  it("조합 중인 마지막 글자까지 이름에 넣는다", async () => {
    renderField();
    openMenu();

    const input = await screen.findByRole("combobox", { name: /참여자 검색/ });
    // **`input` 이벤트여야 한다.** `fireEvent.change` 는 `onInput` 을 안 태운다.
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

  /**
   * **만드는 사이 닫으면 그 draft 는 새 사람을 모른다.** 그대로 저장하면 POST 뒤에 도착한
   * PUT 이 방금 만든 사람을 회의에서 다시 뺀다 — 「추가」를 눌렀는데 사라진다.
   */
  it("만드는 중에 닫아도 방금 만든 사람이 저장에 들어간다", async () => {
    let settle: (value: unknown) => void = () => {};
    createGuestParticipant.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );
    renderField([PARTICIPANT, GUEST_PARTICIPANT]);
    openMenu();

    // **선택을 먼저 바꾼다.** 그래야 닫을 때 저장이 돌고, 그 draft 는 아직 만드는 사람을
    // 모른다 — 여기가 방금 만든 사람을 다시 빼던 자리다.
    const items = await screen.findAllByRole("option");
    fireEvent.click(items[1]); // 박서준(외부) 해제

    fireEvent.change(screen.getByRole("combobox", { name: /참여자 검색/ }), {
      target: { value: "이도현" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /이도현/ }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    // 아직 만들기가 안 끝났다 — 저장을 미룬다.
    expect(replaceGuestParticipants).not.toHaveBeenCalled();

    settle({
      status: 201,
      data: {
        success: true,
        data: {
          participantId: "01K0000000202",
          participants: [
            {
              participantId: "01K0000000202",
              userId: null,
              guestId: "01K0000000302",
              name: "이도현",
              email: null,
              image: null,
            },
          ],
        },
      },
    });

    await waitFor(() =>
      expect(replaceGuestParticipants).toHaveBeenCalledWith({
        noteId: "01K0000000009",
        data: { guestIds: ["01K0000000302"] },
      })
    );
  });

  it("없는 이름을 치면 그 자리에서 임시 참여자를 만든다", async () => {
    renderField();
    openMenu();

    fireEvent.change(await screen.findByRole("combobox", { name: /참여자 검색/ }), {
      target: { value: "  이도현  " },
    });
    fireEvent.click(await screen.findByRole("button", { name: /이도현/ }));

    await waitFor(() =>
      expect(createGuestParticipant).toHaveBeenCalledWith({
        noteId: "01K0000000009",
        // 앞뒤 공백은 보내기 전에 지운다 — 서버도 접지만 목록 대조가 먼저다.
        data: { displayName: "이도현" },
      })
    );
  });
});
