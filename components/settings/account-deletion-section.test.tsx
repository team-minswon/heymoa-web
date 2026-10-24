import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDeletionSection } from "@/components/settings/account-deletion-section";
import type { DeletionPlan } from "@/lib/account/deletion-api";

const state = vi.hoisted(() => ({
  plan: null as DeletionPlan | null,
  deleteAccount: vi.fn(),
  refetch: vi.fn(),
  leave: vi.fn(),
  phase: "idle",
}));

vi.mock("@/lib/account/deletion-api", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/account/deletion-api")
  >("@/lib/account/deletion-api");
  return {
    ...actual,
    useDeletionPlan: () => ({
      isPending: false,
      isError: false,
      data: state.plan,
      refetch: state.refetch,
    }),
    useDeleteAccount: () => ({
      isPending: false,
      mutateAsync: state.deleteAccount,
    }),
  };
});
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ leave: state.leave }),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  isRecordingLive: (recording: { phase: string }) =>
    recording.phase === "recording",
  useRecording: () => ({ phase: state.phase, session: null }),
}));

/** 네 가지 처리를 섞은 계정 — 혼자(삭제) · 다른 관리자 있음(나가기) · 멤버(나가기) · 유일 관리자 + 멤버(넘기기/삭제) */
const PLAN: DeletionPlan = {
  workspaces: [
    {
      workspaceId: "W1",
      name: "개인",
      action: "DELETE",
      successorCandidates: [],
      defaultSuccessorUserId: null,
    },
    {
      workspaceId: "W2",
      name: "공동 관리",
      action: "LEAVE",
      successorCandidates: [],
      defaultSuccessorUserId: null,
    },
    {
      workspaceId: "W3",
      name: "남의 팀",
      action: "LEAVE",
      successorCandidates: [],
      defaultSuccessorUserId: null,
    },
    {
      workspaceId: "W4",
      name: "우리 팀",
      action: "TRANSFER_OR_DELETE",
      successorCandidates: [
        { userId: "U1", name: "한지원", email: "jiwon@heymoa.com" },
        { userId: "U2", name: "김서연", email: "seoyeon@heymoa.com" },
      ],
      defaultSuccessorUserId: "U1",
    },
  ],
};

function open() {
  render(<AccountDeletionSection />);
  fireEvent.click(screen.getByRole("button", { name: "계정 삭제" }));
}

function type(value: string) {
  fireEvent.change(screen.getByLabelText(/확인하려면/), {
    target: { value },
  });
}

const submit = () => screen.getByRole("button", { name: /탈퇴$/ });

describe("AccountDeletionSection", () => {
  beforeEach(() => {
    state.plan = PLAN;
    state.deleteAccount.mockReset().mockResolvedValue({ status: 204 });
    state.refetch.mockReset();
    state.leave.mockReset();
    state.phase = "idle";
  });
  afterEach(cleanup);

  it("워크스페이스별 처리를 서버가 준 대로 보인다", () => {
    open();
    expect(
      screen.getByText("삭제 — 혼자 쓰는 워크스페이스입니다")
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("나가기 — 다른 사람은 계속 씁니다")
    ).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "관리자 넘기기" })).toBeChecked();
  });

  it("지워지는 것과 남는 것은 세 줄이고, 보관 기간은 처리방침 6조로 보낸다", () => {
    open();
    const list = within(
      screen.getByRole("region", { name: "지워지는 것과 남는 것" })
    );
    expect(list.getAllByRole("listitem")).toHaveLength(5);
    expect(
      list.getByRole("link", { name: "보관 기간 자세히 보기" })
    ).toHaveAttribute("href", "/privacy#section-6");
    // 사업자 이름·백업 일수는 처리방침에 둔다(APP-1403).
    expect(screen.queryByText(/PostHog|7일/)).not.toBeInTheDocument();
  });

  it("「회원 탈퇴」를 정확히 입력해야 버튼이 켜진다", () => {
    open();
    expect(submit()).toBeDisabled();
    type("회원탈퇴");
    expect(submit()).toBeDisabled();
    type(" 회원 탈퇴 ");
    expect(submit()).toBeEnabled();
  });

  it("사유를 고르지 않아도 탈퇴하고, 기본 승계자에게 넘긴 뒤 홈으로 간다", async () => {
    open();
    type("회원 탈퇴");
    fireEvent.click(submit());

    await waitFor(() => expect(state.leave).toHaveBeenCalledWith("/"));
    expect(window.sessionStorage.getItem("heymoa:account-deleted")).toBe("1");
    expect(state.deleteAccount).toHaveBeenCalledWith({
      confirmation: "회원 탈퇴",
      workspaces: [
        { workspaceId: "W4", decision: "TRANSFER", successorUserId: "U1" },
      ],
      reason: undefined,
    });
  });

  it("고른 사유 코드와 기타 입력을 본문에 싣고, 삭제를 고르면 삭제로 보낸다", async () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: /워크스페이스 삭제/ }));
    fireEvent.click(screen.getByRole("button", { name: "기타" }));
    fireEvent.change(screen.getByLabelText("기타 사유"), {
      target: { value: " 팀이 해산했어요 " },
    });
    type("회원 탈퇴");
    fireEvent.click(submit());

    await waitFor(() => expect(state.deleteAccount).toHaveBeenCalled());
    expect(state.deleteAccount.mock.calls[0][0]).toMatchObject({
      workspaces: [{ workspaceId: "W4", decision: "DELETE" }],
      reason: { code: "OTHER", detail: "팀이 해산했어요" },
    });
  });

  it("사유를 다시 누르면 고르지 않은 상태로 돌아간다", () => {
    open();
    const reason = screen.getByRole("button", { name: "자주 쓰지 않음" });
    fireEvent.click(reason);
    expect(reason).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(reason);
    expect(reason).toHaveAttribute("aria-pressed", "false");
  });

  it("녹음 중이면 버튼이 꺼지고 이유가 보인다", () => {
    state.phase = "recording";
    open();
    type("회원 탈퇴");
    expect(submit()).toBeDisabled();
    expect(
      screen.getByText("녹음을 끝낸 뒤 탈퇴할 수 있습니다.")
    ).toBeInTheDocument();
  });

  it("그사이 멤버가 바뀌어 거절되면 문구를 남기고 목록을 새로 받는다", async () => {
    state.deleteAccount.mockRejectedValue({
      success: false,
      data: null,
      error: {
        code: "DELETION_PLAN_CHANGED",
        message: "그사이 워크스페이스 멤버가 바뀌었습니다.",
      },
    });
    open();
    type("회원 탈퇴");
    fireEvent.click(submit());

    expect(
      await screen.findByText("그사이 워크스페이스 멤버가 바뀌었습니다.")
    ).toBeInTheDocument();
    expect(state.refetch).toHaveBeenCalled();
    expect(state.leave).not.toHaveBeenCalled();
  });

  it.each([
    [
      "RECORDING_IN_PROGRESS",
      "녹음 중인 회의가 있습니다. 녹음을 끝낸 뒤 다시 시도해 주세요.",
    ],
  ])(
    "%s 로 거절되면 서버 문구를 남기고 나가지 않는다",
    async (code, message) => {
      state.deleteAccount.mockRejectedValue({
        success: false,
        data: null,
        error: { code, message },
      });
      open();
      type("회원 탈퇴");
      fireEvent.click(submit());

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(state.refetch).not.toHaveBeenCalled();
      expect(state.leave).not.toHaveBeenCalled();
    }
  );
});
