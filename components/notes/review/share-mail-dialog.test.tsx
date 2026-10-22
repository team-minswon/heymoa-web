import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShareMailDialog } from "@/components/notes/review/share-mail-dialog";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { name: "김민수" } }),
}));
const membersQuery = vi.hoisted(() => ({
  current: { data: undefined, isError: false, refetch: vi.fn() } as Record<
    string,
    unknown
  >,
}));
vi.mock("@/lib/api/generated/workspace-members/workspace-members", () => ({
  useGetWorkspaceMembers: () => membersQuery.current,
}));

const mutate = vi.hoisted(() => vi.fn());
// 발송 결과 조회. 테스트마다 응답을 갈아 끼운다
const statusQuery = vi.hoisted(() => ({
  current: { data: undefined, isError: false, error: null } as Record<
    string,
    unknown
  >,
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  useSendNoteShareMail: () => ({
    mutate,
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  }),
  useGetNoteShareMail: () => statusQuery.current,
}));
const statusOf = (
  recipients: { email: string; status: "PENDING" | "SENT" | "FAILED" }[]
) => ({
  data: {
    status: 200,
    data: {
      success: true,
      data: {
        mailId: "0K9GVJT2C4Q22",
        requestedAt: "2026-10-16T05:00:00Z",
        completed: recipients.every((row) => row.status !== "PENDING"),
        recipients,
      },
      error: null,
    },
  },
  isError: false,
  error: null,
});

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastDismiss = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    info: vi.fn(),
    dismiss: toastDismiss,
  },
}));

const PDF = new Blob(["%PDF-1.4"], { type: "application/pdf" });

function setup(
  overrides: Partial<React.ComponentProps<typeof ShareMailDialog>> = {}
) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    noteId: "N1",
    workspaceId: "W1",
    meeting: { title: "공유 기능 범위 정리", whenIso: "2026-10-15T05:00:00Z" },
    attendees: [
      { name: "강성재", email: "sungjae@mentor.kr" },
      { name: "이서연", email: "seoyeon@heymoa.ai" },
    ],
    unnamedSpeakers: ["화자 C"],
    buildPdf: vi.fn(async () => PDF),
    ...overrides,
  };
  const view = render(<ShareMailDialog {...props} />);
  return Object.assign(props, {
    rerender: (next: Partial<typeof props>) =>
      view.rerender(<ShareMailDialog {...props} {...next} />),
  });
}

const type = (text: string) =>
  fireEvent.change(screen.getByRole("combobox"), { target: { value: text } });

describe("ShareMailDialog", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mutate.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    toastDismiss.mockReset();
    statusQuery.current = { data: undefined, isError: false, error: null };
  });

  it("받는 사람이 없거나 틀린 주소가 있으면 보내기가 막힌다", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "보내기" }).hasAttribute("disabled")
    ).toBe(true);
    type("a@x.com, oops,");
    expect(screen.getByRole("alert").textContent).toContain("oops");
    expect(
      screen
        .getByRole("button", { name: "2명에게 보내기" })
        .hasAttribute("disabled")
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "oops 빼기" }));
    expect(
      screen
        .getByRole("button", { name: "1명에게 보내기" })
        .hasAttribute("disabled")
    ).toBe(false);
  });

  it("녹취록을 켜고 닫았다 다시 열면 녹취록은 꺼져 있고, 쓰던 받는 사람은 남는다", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("switch", { name: "녹취록" }));
    fireEvent.click(
      screen.getByRole("button", { name: "참석자 모두 추가 (2명)" })
    );
    props.rerender({ open: false });
    props.rerender({ open: true });
    expect(screen.getByRole("switch", { name: "녹취록" })).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "2명에게 보내기" })
    ).toBeInTheDocument();
  });

  it("멤버를 못 불러오면 빈 후보로 접지 않고 알리며 다시 불러올 수 있다", () => {
    const refetch = vi.fn();
    membersQuery.current = { data: undefined, isError: true, refetch };
    try {
      setup();
      expect(
        screen.getByText(/워크스페이스 멤버를 불러오지 못했습니다/)
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /다시/ }));
      expect(refetch).toHaveBeenCalled();
    } finally {
      membersQuery.current = {
        data: undefined,
        isError: false,
        refetch: vi.fn(),
      };
    }
  });

  it("10명을 넘으면 알리고 보내기를 막는다", () => {
    setup();
    type(`${Array.from({ length: 11 }, (_, i) => `p${i}@x.com`).join(",")},`);
    expect(screen.getByRole("alert").textContent).toContain("1명을 빼");
    expect(
      screen
        .getByRole("button", { name: "11명에게 보내기" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("녹취록을 켜면 이름 없는 화자를 알리고, 녹취록이 PDF 생성과 요청에 실린다 — 붙임은 녹취록 하나다", async () => {
    const props = setup();
    expect(screen.queryByText(/이름 없는 화자/)).toBeNull();
    expect(screen.queryByRole("switch", { name: "안건별 경과" })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "녹취록" }));
    expect(screen.getByRole("status").textContent).toContain("「화자 C」");

    fireEvent.click(
      screen.getByRole("button", { name: "참석자 모두 추가 (2명)" })
    );
    fireEvent.click(screen.getByRole("button", { name: "2명에게 보내기" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(props.buildPdf).toHaveBeenCalledWith({ transcript: true });
    const [variables, callbacks] = mutate.mock.calls[0];
    expect(variables).toEqual({
      noteId: "N1",
      data: {
        file: PDF,
        recipients: ["sungjae@mentor.kr", "seoyeon@heymoa.ai"],
        message: undefined,
        include: ["TRANSCRIPT"],
      },
    });

    statusQuery.current = statusOf([
      { email: "sungjae@mentor.kr", status: "SENT" },
      { email: "seoyeon@heymoa.ai", status: "PENDING" },
    ]);
    act(() =>
      callbacks.onSuccess({
        status: 202,
        data: { success: true, data: { mailId: "0K9GVJT2C4Q22" }, error: null },
      })
    );
    // 202 는 접수일 뿐이라 창을 닫지 않고 받는 사람별 결과를 그린다. 「보냄」이지 「전달됨」이 아니다
    const results = screen.getByRole("list", { name: "받는 사람별 결과" });
    expect(results.textContent).toContain("sungjae@mentor.kr보냄");
    expect(results.textContent).toContain("seoyeon@heymoa.ai보내는 중");
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("보내지 못한 주소만 받는 사람 칸에 다시 채운다 — 이유를 몰라 바로 보내지 않는다", () => {
    setup();
    fireEvent.click(
      screen.getByRole("button", { name: "참석자 모두 추가 (2명)" })
    );
    fireEvent.click(screen.getByRole("button", { name: "2명에게 보내기" }));
    return waitFor(() => expect(mutate).toHaveBeenCalled()).then(() => {
      const [, callbacks] = mutate.mock.calls[0];
      statusQuery.current = statusOf([
        { email: "sungjae@mentor.kr", status: "SENT" },
        { email: "seoyeon@heymoa.ai", status: "FAILED" },
      ]);
      act(() =>
        callbacks.onSuccess({
          status: 202,
          data: {
            success: true,
            data: { mailId: "0K9GVJT2C4Q22" },
            error: null,
          },
        })
      );
      fireEvent.click(
        screen.getByRole("button", { name: "보내지 못한 1명 다시 보내기" })
      );
      expect(
        screen.getByRole("button", { name: "1명에게 보내기" })
      ).toBeInTheDocument();
      expect(mutate).toHaveBeenCalledTimes(1);
    });
  });

  describe("창을 닫은 뒤의 결과", () => {
    const sendTwo = async () => {
      const props = setup();
      fireEvent.click(
        screen.getByRole("button", { name: "참석자 모두 추가 (2명)" })
      );
      fireEvent.click(screen.getByRole("button", { name: "2명에게 보내기" }));
      await waitFor(() => expect(mutate).toHaveBeenCalled());
      const [, callbacks] = mutate.mock.calls[0];
      statusQuery.current = statusOf([
        { email: "sungjae@mentor.kr", status: "PENDING" },
        { email: "seoyeon@heymoa.ai", status: "PENDING" },
      ]);
      act(() =>
        callbacks.onSuccess({
          status: 202,
          data: {
            success: true,
            data: { mailId: "0K9GVJT2C4Q22" },
            error: null,
          },
        })
      );
      return props;
    };

    it("닫은 뒤 「보내지 못함」이 나오면 토스트로 알리고, 다시 보내기는 그 주소만 채운 창을 연다", async () => {
      const props = await sendTwo();
      props.rerender({ open: false });
      statusQuery.current = statusOf([
        { email: "sungjae@mentor.kr", status: "SENT" },
        { email: "seoyeon@heymoa.ai", status: "FAILED" },
      ]);
      props.rerender({ open: false });

      expect(toastError).toHaveBeenCalledTimes(1);
      const [message, options] = toastError.mock.calls[0];
      expect(message).toBe("회의록 메일을 1명에게 보내지 못했습니다.");
      expect(options.description).toBe("seoyeon@heymoa.ai");
      act(() => options.action.onClick());
      expect(props.onOpenChange).toHaveBeenCalledWith(true);
      props.rerender({ open: true });
      expect(
        screen.getByRole("button", { name: "1명에게 보내기" })
      ).toBeInTheDocument();
    });

    it("모두 「보냄」이면 아무것도 띄우지 않는다", async () => {
      const props = await sendTwo();
      props.rerender({ open: false });
      statusQuery.current = statusOf([
        { email: "sungjae@mentor.kr", status: "SENT" },
        { email: "seoyeon@heymoa.ai", status: "SENT" },
      ]);
      props.rerender({ open: false });
      expect(toastError).not.toHaveBeenCalled();
    });

    it("「보내는 중」일 때 닫았다 다시 열면 그 발송의 결과 화면이 남는다 — 추적이 끊기지 않는다", async () => {
      const props = await sendTwo();
      props.rerender({ open: false });
      props.rerender({ open: true });
      expect(
        screen.getByRole("list", { name: "받는 사람별 결과" }).textContent
      ).toContain("보내는 중");
    });

    it("결과 조회가 실패하면 다시 시도가 실제로 다시 묻는다", async () => {
      const props = await sendTwo();
      const refetch = vi.fn();
      statusQuery.current = {
        data: undefined,
        isError: true,
        error: new Error("network"),
        refetch,
      };
      props.rerender({ open: true });
      fireEvent.click(screen.getByRole("button", { name: /다시 시도/ }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("아직 보내는 중인 주소가 있으면 실패 주소 다시 보내기를 세우지 않는다", async () => {
      const props = await sendTwo();
      statusQuery.current = statusOf([
        { email: "sungjae@mentor.kr", status: "FAILED" },
        { email: "seoyeon@heymoa.ai", status: "PENDING" },
      ]);
      props.rerender({ open: true });
      expect(screen.queryByRole("button", { name: /다시 보내기/ })).toBeNull();
    });

    it("조회가 실패한 채 닫았다 다시 열어도 그 발송을 지우지 않는다 — 서버는 아직 보내는 중일 수 있다", async () => {
      const props = await sendTwo();
      statusQuery.current = {
        data: undefined,
        isError: true,
        error: new Error("network"),
        refetch: vi.fn(),
      };
      props.rerender({ open: false });
      props.rerender({ open: true });
      expect(
        screen.getByRole("button", { name: /다시 시도/ })
      ).toBeInTheDocument();
    });

    it("예전 발송의 토스트를 새로 보낸 뒤에 눌러도 새 발송의 결과를 지우지 않는다", async () => {
      const props = await sendTwo();
      props.rerender({ open: false });
      statusQuery.current = statusOf([
        { email: "sungjae@mentor.kr", status: "SENT" },
        { email: "seoyeon@heymoa.ai", status: "FAILED" },
      ]);
      props.rerender({ open: false });
      const [, oldToast] = toastError.mock.calls[0];

      // 다시 열어 새로 보낸다 — 예전 토스트는 거둔다
      props.rerender({ open: true });
      fireEvent.click(
        screen.getByRole("button", { name: "참석자 모두 추가 (2명)" })
      );
      fireEvent.click(screen.getByRole("button", { name: "2명에게 보내기" }));
      await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
      const [, callbacks] = mutate.mock.calls[1];
      statusQuery.current = statusOf([
        { email: "sungjae@mentor.kr", status: "PENDING" },
      ]);
      act(() =>
        callbacks.onSuccess({
          status: 202,
          data: {
            success: true,
            data: { mailId: "0K9NEWMAIL000" },
            error: null,
          },
        })
      );
      expect(toastDismiss).toHaveBeenCalledWith("share-mail-0K9GVJT2C4Q22");

      act(() => oldToast.action.onClick());
      expect(
        screen.getByRole("list", { name: "받는 사람별 결과" })
      ).toBeInTheDocument();
    });

    it("창 안에서 이미 본 실패는 닫아도 다시 알리지 않는다", async () => {
      const props = await sendTwo();
      statusQuery.current = statusOf([
        { email: "sungjae@mentor.kr", status: "SENT" },
        { email: "seoyeon@heymoa.ai", status: "FAILED" },
      ]);
      props.rerender({ open: true });
      props.rerender({ open: false });
      expect(toastError).not.toHaveBeenCalled();
    });
  });
});
