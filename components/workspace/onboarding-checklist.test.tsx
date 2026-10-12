import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingChecklist } from "@/components/workspace/onboarding-checklist";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useWorkspaceShell: () => ({
    openCreateProject: vi.fn(),
    requestNewMeeting: vi.fn(),
    openSettings: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("OnboardingChecklist", () => {
  it("단계를 남은 것과 끝난 것으로 보인다", () => {
    render(
      <OnboardingChecklist
        workspaceId="W1"
        model={{ userId: "u1", done: new Set(["project"]), hasMoreNotes: false }}
      />
    );

    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.queryByText("데스크톱 앱 받기")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /팀원 초대하기\s*선택/ })).toBeEnabled();
    expect(screen.getByText("(완료)", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /첫 회의 기록하기/ })).toBeEnabled();
  });

  // 초대를 안 해도 필수 셋을 마치면 끝난 것으로 보인다
  it("필수 단계를 마치면 초대 없이도 준비가 끝났다고 보인다", () => {
    render(
      <OnboardingChecklist
        workspaceId="W1"
        model={{
          userId: "u1",
          done: new Set(["project", "record", "confirm"]),
          hasMoreNotes: false,
        }}
      />
    );

    expect(screen.getByText("준비가 끝났어요")).toBeInTheDocument();
    expect(screen.getByText("3/3")).toBeInTheDocument();
  });

  // 목록을 못 읽었는데 그대로 그리면 기록이 없는 것처럼 「첫 회의 기록하기」가 미완료로 보인다
  it("진행을 못 읽으면 단계 대신 실패와 다시 시도를 보인다", () => {
    const retry = vi.fn();
    render(
      <OnboardingChecklist
        workspaceId="W1"
        model={{ userId: "u1", done: new Set(), hasMoreNotes: false, retry }}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("진행 상황을 불러오지 못했습니다");
    expect(screen.queryByText("첫 회의 기록하기")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(retry).toHaveBeenCalled();
  });
});
