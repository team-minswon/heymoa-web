import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteSummary } from "@/components/notes/note-summary";

const state = vi.hoisted(() => ({
  analysis: null as Record<string, unknown> | null,
  missing: false,
  isLoading: false,
  isFetching: false,
  requestMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useGetLatestAnalysis: () => ({
    isLoading: state.isLoading,
    isFetching: state.isFetching,
    isError: state.missing,
    refetch: state.refetchMock,
    error: state.missing
      ? {
          success: false,
          data: null,
          error: { code: "ANALYSIS_JOB_NOT_FOUND", message: "없음" },
        }
      : null,
    data: state.analysis
      ? { status: 200, data: { success: true, data: state.analysis } }
      : undefined,
  }),
  useRequestAnalysis: () => ({ mutate: state.requestMock, isPending: false }),
}));

function renderSummary(isEnded: boolean) {
  return render(<NoteSummary noteId="01K0000000002" isEnded={isEnded} />);
}

describe("NoteSummary", () => {
  beforeEach(() => {
    state.analysis = null;
    state.missing = false;
    state.isLoading = false;
    state.isFetching = false;
    state.requestMock.mockReset();
    state.refetchMock.mockReset();
  });
  afterEach(cleanup);

  it("PENDING이면 분석 진행 스켈레톤을 보인다", () => {
    state.analysis = { status: "PENDING", overview: null, actionItems: null, insights: null };
    renderSummary(true);
    expect(screen.getByText("회의를 정리하고 있습니다")).toBeTruthy();
  });

  it("SUCCEEDED면 요약 3종을 마크다운으로 그린다", () => {
    state.analysis = {
      status: "SUCCEEDED",
      overview: "출시 일정을 정했습니다.",
      actionItems: "- 배포 체크리스트\n- QA 일정 공유",
      insights: "- 일정 리스크는 QA에 몰려 있습니다.",
    };
    const { container } = renderSummary(true);
    expect(screen.getByText("출시 일정을 정했습니다.")).toBeTruthy();
    expect(screen.getByText("배포 체크리스트")).toBeTruthy();
    expect(container.querySelectorAll("ul li").length).toBeGreaterThanOrEqual(3);
  });

  it("FAILED면 사유와 다시 분석 버튼을 보인다", () => {
    state.analysis = {
      status: "FAILED",
      overview: null,
      actionItems: null,
      insights: null,
      errorCode: "LLM_TIMEOUT",
      errorMessage: "분석이 시간 초과됐습니다.",
    };
    renderSummary(true);
    expect(screen.getByText(/시간 초과/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 분석" }));
    expect(state.requestMock).toHaveBeenCalledWith(
      { noteId: "01K0000000002" },
      expect.anything()
    );
  });

  it("종료됐는데 분석이 없으면(404) 요약 만들기를 준다", () => {
    state.missing = true;
    renderSummary(true);
    expect(screen.getByText("아직 요약이 없습니다")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "요약 만들기" }));
    expect(state.requestMock).toHaveBeenCalled();
  });

  it("종료 전에는 안내만 보이고 요약 만들기 버튼이 없다", () => {
    state.missing = true;
    renderSummary(false);
    expect(screen.getByText("요약은 회의가 끝나면 생성됩니다")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "요약 만들기" })).toBeNull();
  });

  it("요청 뒤 refetch가 끝날 때까지 재분석 버튼을 잠근다 — 중복 202 방지", () => {
    // 202 뒤 mutation은 끝나지만 refetch가 도착하기 전 낡은 FAILED가 남는다. isFetching 동안 잠근다.
    state.analysis = {
      status: "FAILED",
      overview: null,
      actionItems: null,
      insights: null,
      errorCode: "X",
      errorMessage: "실패",
    };
    state.isFetching = true;
    renderSummary(true);
    expect(screen.getByRole("button", { name: "다시 분석" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("회의가 (다른 참가자에 의해) 종료된 순간 분석을 다시 읽는다", () => {
    // 404가 폴링을 멈춘 상태에서 isEnded가 참으로 바뀌면 자동 생성된 분석을 잡아야 한다.
    state.missing = true;
    const view = render(<NoteSummary noteId="01K0000000002" isEnded={false} />);
    expect(state.refetchMock).not.toHaveBeenCalled();

    view.rerender(<NoteSummary noteId="01K0000000002" isEnded={true} />);
    expect(state.refetchMock).toHaveBeenCalled();
  });
});
