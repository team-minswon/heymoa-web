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

  it("다시 요청할 수 없는 분석 실패는 버튼 없이 기록 준비가 늦어진다고 말한다", () => {
    renderNotice("ANALYSIS_FAILED", true, false);
    expect(screen.queryByRole("button", { name: /분석/ })).toBeNull();
    expect(
      screen.getByText("회의 기록 준비가 늦어지고 있습니다")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
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
