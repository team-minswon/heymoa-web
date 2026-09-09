import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectConceptSummary } from "@/components/workspace/project-concept-summary";
import { sampleConceptSummary } from "@/lib/notes/meeting-review/fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// 시트는 포털·애니메이션이라 jsdom 에서 볼 것이 없다. 내용만 그린다.
vi.mock("@/components/notes/note-route-surface", () => ({
  NoteRouteSurface: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/api/generated/projects/projects", () => ({
  useGetProject: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: { projectId: "p", name: "결제 프로젝트", description: "원본 설명" },
      },
    },
  }),
}));

const fetchConceptSummary = vi.fn();
const refreshConceptSummary = vi.fn();
vi.mock("@/lib/notes/meeting-review/api", () => ({
  fetchConceptSummary: (...args: unknown[]) => fetchConceptSummary(...args),
  refreshConceptSummary: (...args: unknown[]) => refreshConceptSummary(...args),
}));

function renderSummary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectConceptSummary workspaceId="ws" projectId="01K0000000P01" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  fetchConceptSummary.mockReset();
  refreshConceptSummary.mockReset();
  push.mockReset();
});
afterEach(() => cleanup());

describe("ProjectConceptSummary", () => {
  it("READY 는 네 묶음과 근거를 그리고 AI 생성 결과임을 배지로 못박는다", async () => {
    fetchConceptSummary.mockResolvedValue(sampleConceptSummary());
    renderSummary();
    await screen.findByText("최신 승인 기준의 요약입니다");
    expect(screen.getByText("AI 가 승인 사실을 설명한 결과")).toBeInTheDocument();
    expect(screen.getByText("결제 프로젝트")).toBeInTheDocument();
    for (const title of ["목적과 범위", "핵심 개념과 용어", "현재 방향", "남은 쟁점"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    // 근거를 열면 회의로 가는 링크가 있다.
    const statement = screen.getAllByTestId("summary-statement")[1];
    fireEvent.click(statement.querySelector("button")!);
    expect(statement).toHaveTextContent("승인 항목");
    expect(statement.querySelector("a")?.getAttribute("href")).toContain("/w/ws/notes/01K0000000001");
  });

  it("STALE 은 이전 결과를 그대로 두고 기준 버전과 지금 버전을 함께 보여 준다", async () => {
    fetchConceptSummary.mockResolvedValue(
      sampleConceptSummary({ status: "STALE", current: { descriptionRevision: 2, approvalVersion: 5 } })
    );
    renderSummary();
    await screen.findByText(/이 요약은 이전 기준입니다/);
    expect(screen.getByText("오래됨")).toBeInTheDocument();
    expect(screen.getByText("3 → 지금 5")).toBeInTheDocument();
    expect(screen.getAllByTestId("summary-statement").length).toBeGreaterThan(0);
  });

  it("GENERATING 은 spinner 한 줄이고 갱신 버튼이 잠긴다", async () => {
    fetchConceptSummary.mockResolvedValue(sampleConceptSummary({ status: "GENERATING" }));
    renderSummary();
    await screen.findByRole("status");
    expect(screen.getByTestId("refresh-summary")).toBeDisabled();
  });

  it("FAILED · INSUFFICIENT_EVIDENCE · NONE 이 서로 다르게 보이고, NONE 은 「요약 만들기」다", async () => {
    fetchConceptSummary.mockResolvedValue(
      sampleConceptSummary({ status: "FAILED", error: "모델 응답 없음" })
    );
    const first = renderSummary();
    await screen.findByText(/요약을 만들지 못했습니다 · 모델 응답 없음/);
    first.unmount();

    fetchConceptSummary.mockResolvedValue(sampleConceptSummary({ status: "INSUFFICIENT_EVIDENCE" }));
    const second = renderSummary();
    await screen.findByText("요약할 근거가 아직 부족합니다");
    second.unmount();

    fetchConceptSummary.mockResolvedValue(
      sampleConceptSummary({
        status: "NONE",
        sections: { purposeAndScope: [], concepts: [], direction: [], openIssues: [] },
      })
    );
    renderSummary();
    await screen.findByText("아직 요약이 없습니다");
    expect(screen.getByTestId("refresh-summary")).toHaveTextContent("요약 만들기");
  });

  it("갱신은 요청 하나이고 web 이 요약을 만들지 않는다", async () => {
    fetchConceptSummary.mockResolvedValue(sampleConceptSummary());
    refreshConceptSummary.mockResolvedValue(undefined);
    renderSummary();
    await screen.findByText("최신 승인 기준의 요약입니다");
    fireEvent.click(screen.getByTestId("refresh-summary"));
    await waitFor(() => expect(refreshConceptSummary).toHaveBeenCalledWith("01K0000000P01"));
  });

  it("닫으면 워크스페이스 목록으로 돌아간다", async () => {
    fetchConceptSummary.mockResolvedValue(sampleConceptSummary());
    renderSummary();
    await screen.findByText("최신 승인 기준의 요약입니다");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(push).toHaveBeenCalledWith("/w/ws");
  });
});
