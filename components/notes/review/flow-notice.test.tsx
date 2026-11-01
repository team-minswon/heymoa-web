import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FlowNotice } from "@/components/notes/review/flow-notice";

vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useRequestAnalysis: () => ({ mutate: vi.fn(), isPending: false }),
  getGetAnalysisFlowQueryKey: (noteId: string) => ["flow", noteId],
}));

type Status = "NOT_REQUESTED" | "ANALYZING" | "ANALYSIS_FAILED" | "DIARIZING";

function renderNotice(
  status: Status,
  verified = true,
  // 서버가 이 상태에서 보통 내는 값. 입력 준비가 늦어진 실패만 따로 거짓을 넘긴다
  retryable = status === "NOT_REQUESTED" || status === "ANALYSIS_FAILED"
) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <FlowNotice
        noteId="n1"
        status={status}
        retryable={retryable}
        verified={verified}
        onOpenTranscript={vi.fn()}
      />
    </QueryClientProvider>
  );
}

/**
 * APP-1103. 종료 직후 자동 요청이 행을 만들기 전의 틈은 서버가 `ANALYZING` 으로 말한다(APP-1100).
 * 그래서 `NOT_REQUESTED` 는 자동 요청이 실제로 안 만들어진 경우뿐이고, 그때는 바로 직접 요청할 수
 * 있어야 한다. APP-1099 의 10초 숨김을 걷어 낸 뒤의 동작을 고정한다.
 */
describe("FlowNotice", () => {
  afterEach(cleanup);

  it("NOT_REQUESTED 면 바로 직접 요청할 수 있다", () => {
    renderNotice("NOT_REQUESTED");
    expect(screen.getByRole("button", { name: "분석 요청" })).toBeTruthy();
  });

  it("ANALYZING 이면 진행 표시만 있고 요청 버튼은 없다", () => {
    renderNotice("ANALYZING");
    expect(screen.getByText("회의를 분석하는 중입니다")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /분석/ })).toBeNull();
  });

  it("분석 실패는 다시 분석을 내놓는다", () => {
    renderNotice("ANALYSIS_FAILED");
    expect(screen.getByRole("button", { name: "다시 분석" })).toBeTruthy();
  });

  // 종료 뒤 상한이 지나도 녹음 반영이 끝나지 않아 실패로 보이는 경우. 서버는 다시 요청을 409 로
  // 거절하므로 버튼을 주면 누를 때마다 실패만 돌아온다(APP-1475)
  it("다시 요청할 수 없는 분석 실패는 버튼 없이 기록 준비가 늦어진다고 말한다", () => {
    renderNotice("ANALYSIS_FAILED", true, false);
    expect(screen.queryByRole("button", { name: /분석/ })).toBeNull();
    expect(
      screen.getByText("회의 기록 준비가 늦어지고 있습니다")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    // 서버는 실패로 판정했다. 끝난다는 보장이 없어 진행 중으로 그리지 않는다
    expect(screen.queryByLabelText("회의 정리: 진행 중")).toBeNull();
    expect(screen.getByLabelText("회의 정리: 대기")).toBeInTheDocument();
  });

  it("요청 전이어도 서버가 받지 않으면 요청 버튼을 내놓지 않는다", () => {
    renderNotice("NOT_REQUESTED", true, false);
    expect(screen.queryByRole("button", { name: "분석 요청" })).toBeNull();
  });

  it("화자 분리 중에는 요청 버튼이 없다", () => {
    renderNotice("DIARIZING");
    expect(screen.queryByRole("button", { name: /분석/ })).toBeNull();
  });
});

it("이번 화면에서 확인하지 않은 캐시만으로 수동 분석 버튼을 내놓지 않는다", () => {
  const view = renderNotice("NOT_REQUESTED", false);
  expect(screen.queryByRole("button", { name: "분석 요청" })).toBeNull();
  view.unmount();
  renderNotice("NOT_REQUESTED", true);
  expect(screen.getByRole("button", { name: "분석 요청" })).toBeInTheDocument();
});
