import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MeetingControls } from "@/components/notes/meeting-controls";
import type { NoteResponseData } from "@/lib/api/generated/models";

const state = vi.hoisted(() => ({ userId: "user-12345" }));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: state.userId, name: "테스트 유저" } }),
}));
vi.mock("@/components/notes/meeting-end-dialog", () => ({
  MeetingEndDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="end-dialog" /> : null,
}));

function note(overrides: Partial<NoteResponseData>): NoteResponseData {
  return {
    noteId: "01K0000000002",
    title: "주간 회의",
    projectId: "01K0000000001",
    createdAt: "2026-07-24T00:00:00Z",
    updatedAt: "2026-07-24T00:00:00Z",
    meetingStatus: "IN_PROGRESS",
    meetingStartedBy: { userId: "user-12345", name: "테스트 유저" },
    ...overrides,
  } as NoteResponseData;
}

const renderControls = (n: NoteResponseData, showContext?: boolean) =>
  render(<MeetingControls note={n} showContext={showContext} />);

describe("MeetingControls", () => {
  beforeEach(() => {
    state.userId = "user-12345";
  });
  afterEach(cleanup);

  it("시작자 · 진행 중이면 회의 종료만 보인다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    expect(screen.getByRole("button", { name: /회의 종료/ })).toBeTruthy();
    // APP-218에서 회의 중지·재개를 폐기했다 — "멈춤"은 레코더 독이 단독으로 맡는다.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /중지/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /재개/ })).toBeNull();
    expect(screen.queryByText("진행 중")).toBeNull();
    expect(screen.queryByText("테스트 유저")).toBeNull();
  });

  it("문맥 표시를 요청하면 시작자에게 상태와 시작자명과 종료를 함께 보인다", () => {
    renderControls(
      note({ meetingStartedBy: { userId: "user-12345", name: "김민수" } }),
      true
    );

    expect(screen.getByText("진행 중")).toBeTruthy();
    expect(screen.getByText("김민수").textContent).toBe(
      "김민수님이 시작한 회의"
    );
    expect(screen.getByRole("button", { name: /회의 종료/ })).toBeTruthy();
  });

  it("녹음 중에도 회의 종료가 잠기지 않는다", () => {
    // 녹음이 살아 있을 때의 차단·안내는 MeetingEndDialog가 소유한다(계약 409를 권위로 삼는다).
    // 여기서 미리 잠그면 다이얼로그가 사유를 보여줄 기회 자체가 없어진다.
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    expect(
      screen.getByRole("button", { name: /회의 종료/ })
    ).not.toHaveProperty("disabled", true);
  });

  it("뷰어(시작자 아님)는 버튼 없이 상태와 시작자를 보인다", () => {
    state.userId = "user-other";

    renderControls(
      note({ meetingStartedBy: { userId: "user-12345", name: "김민수" } })
    );

    expect(screen.getByText("진행 중")).toBeTruthy();
    expect(screen.getByText("김민수").textContent).toBe(
      "김민수님이 시작한 회의"
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("뷰어의 시작자 이름은 모바일에서도 보이고 전체 설명은 접근 가능하다", () => {
    state.userId = "user-other";

    renderControls(
      note({ meetingStartedBy: { userId: "user-12345", name: "김민수" } })
    );

    const name = screen.getByText("김민수");
    expect(name.classList.contains("hidden")).toBe(false);
    expect(name.classList.contains("truncate")).toBe(true);
    const description = screen.getByText("님이 시작한 회의");
    expect(description.classList.contains("sr-only")).toBe(true);
    expect(description.classList.contains("sm:not-sr-only")).toBe(true);
  });

  it("종료된 회의는 종료됨 배지만 보인다", () => {
    renderControls(note({ meetingStatus: "ENDED" }));

    expect(screen.getByText("회의 종료됨")).toBeTruthy();
    expect(screen.queryByText("테스트 유저")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("종료된 회의도 문맥 표시를 요청하면 시작자명을 보이되 종료 버튼은 두지 않는다", () => {
    renderControls(
      note({
        meetingStatus: "ENDED",
        meetingStartedBy: { userId: "user-12345", name: "김민수" },
      }),
      true
    );

    expect(screen.getByText("회의 종료됨")).toBeTruthy();
    expect(screen.getByText("김민수").textContent).toBe(
      "김민수님이 시작한 회의"
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("아직 시작 전(startedBy null)이면 아무것도 그리지 않는다", () => {
    const { container } = renderControls(note({ meetingStartedBy: null }));

    expect(container.textContent).toBe("");
  });

  it("회의 종료를 누르면 확인 다이얼로그를 연다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    fireEvent.click(screen.getByRole("button", { name: /회의 종료/ }));

    expect(screen.getByTestId("end-dialog")).toBeTruthy();
  });
});
