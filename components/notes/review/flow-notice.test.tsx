import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FlowNotice } from "@/components/notes/review/flow-notice";

vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useRequestAnalysis: () => ({ mutate: vi.fn(), isPending: false }),
  getGetAnalysisFlowQueryKey: (noteId: string) => ["flow", noteId],
}));

type Status = "NOT_REQUESTED" | "ANALYZING" | "ANALYSIS_FAILED" | "DIARIZING";

function renderNotice(status: Status) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <FlowNotice noteId="n1" status={status} onOpenTranscript={vi.fn()} />
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

  it("화자 분리 중에는 요청 버튼이 없다", () => {
    renderNotice("DIARIZING");
    expect(screen.queryByRole("button", { name: /분석/ })).toBeNull();
  });
});
