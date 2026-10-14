import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FlowNotice,
  REQUEST_GRACE_MS,
} from "@/components/notes/review/flow-notice";

vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useRequestAnalysis: () => ({ mutate: vi.fn(), isPending: false }),
  getGetAnalysisFlowQueryKey: (noteId: string) => ["flow", noteId],
}));

type Status = "NOT_REQUESTED" | "ANALYZING" | "ANALYSIS_FAILED";

// 처음 본 시각이 모듈에 남으므로 테스트마다 다른 회의를 쓴다.
let seq = 0;
function renderNotice(status: Status, noteId = `n${++seq}`) {
  const client = new QueryClient();
  const ui = (s: Status, id: string) => (
    <QueryClientProvider client={client}>
      <FlowNotice noteId={id} status={s} onOpenTranscript={vi.fn()} />
    </QueryClientProvider>
  );
  const view = render(ui(status, noteId));
  return { ...view, update: (s: Status, id = noteId) => view.rerender(ui(s, id)) };
}

const requestButton = () => screen.queryByRole("button", { name: "분석 요청" });

describe("FlowNotice", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("종료 직후 NOT_REQUESTED 에서는 자동 요청을 기다리며 버튼을 숨긴다", () => {
    renderNotice("NOT_REQUESTED");
    expect(screen.queryByRole("button", { name: "분석 요청" })).toBeNull();
  });

  it("기다린 뒤에도 NOT_REQUESTED 면 직접 요청할 수 있다", () => {
    renderNotice("NOT_REQUESTED");
    act(() => vi.advanceTimersByTime(REQUEST_GRACE_MS));
    expect(screen.getByRole("button", { name: "분석 요청" })).toBeTruthy();
  });

  it("기다리기 직전까지는 숨긴다", () => {
    renderNotice("NOT_REQUESTED");
    act(() => vi.advanceTimersByTime(REQUEST_GRACE_MS - 1));
    expect(requestButton()).toBeNull();
  });

  it("탭을 오가 다시 그려도 처음 본 시각부터 잰다", () => {
    const first = renderNotice("NOT_REQUESTED", "same");
    act(() => vi.advanceTimersByTime(REQUEST_GRACE_MS - 1_000));
    first.unmount();
    renderNotice("NOT_REQUESTED", "same");
    act(() => vi.advanceTimersByTime(1_000));
    expect(requestButton()).toBeTruthy();
  });

  it("다른 회의로 바뀌면 그 회의의 기다림을 새로 잰다", () => {
    const view = renderNotice("NOT_REQUESTED");
    act(() => vi.advanceTimersByTime(REQUEST_GRACE_MS));
    expect(requestButton()).toBeTruthy();
    view.update("NOT_REQUESTED", `n${++seq}`);
    expect(requestButton()).toBeNull();
  });

  it("상태가 오가도 처음 본 시각을 유지한다", () => {
    const view = renderNotice("NOT_REQUESTED");
    act(() => vi.advanceTimersByTime(REQUEST_GRACE_MS - 1_000));
    view.update("ANALYZING");
    act(() => vi.advanceTimersByTime(2_000));
    view.update("NOT_REQUESTED");
    act(() => vi.advanceTimersByTime(0));
    expect(requestButton()).toBeTruthy();
  });

  it("분석 실패는 기다리지 않고 다시 분석을 내놓는다", () => {
    renderNotice("ANALYSIS_FAILED");
    expect(screen.getByRole("button", { name: "다시 분석" })).toBeTruthy();
  });
});
