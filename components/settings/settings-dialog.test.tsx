import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "@/components/settings/settings-dialog";

vi.mock("@/components/settings/account-settings-form", () => ({
  AccountSettingsForm: () => <p>계정 내용</p>,
  AccountSettingsFormSkeleton: () => <p>계정 로딩</p>,
}));
vi.mock("@/components/settings/workspace-settings-form", () => ({
  WorkspaceSettingsForm: () => <p>워크스페이스 내용</p>,
  WorkspaceSettingsFormSkeleton: () => <p>워크스페이스 로딩</p>,
}));
vi.mock("@/components/settings/members-settings", () => ({
  MembersSettings: () => <p>멤버 내용</p>,
}));
vi.mock("@/components/settings/workspace-integrations-settings", () => ({
  WorkspaceIntegrationsSettings: () => <p>연동 내용</p>,
}));
vi.mock("@/components/settings/workspace-agent-access-settings", () => ({
  WorkspaceAgentAccessSettings: () => <p>외부 에이전트 관리 내용</p>,
}));
vi.mock("@/components/settings/agent-connections-settings", () => ({
  AgentConnectionsSettings: ({
    onBusyChange,
  }: {
    onBusyChange?: (busy: boolean) => void;
  }) => (
    <button type="button" onClick={() => onBusyChange?.(true)}>
      토큰 요청 시작
    </button>
  ),
}));

describe("SettingsDialog", () => {
  // 외부 에이전트 토큰은 만든 응답에서만 한 번 나온다 — 그 사이 닫히면 아무도 못 본다
  it("섹션이 잠근 동안에는 닫히지도 다른 섹션으로 옮기지도 않는다", () => {
    const onOpenChange = vi.fn();
    render(
      <SettingsDialog
        open
        onOpenChange={onOpenChange}
        initialSection="agents"
        workspaceId="01K0000000000"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "토큰 요청 시작" }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(
      (screen.getByRole("button", { name: "내 계정" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("switches between the supported sections without navigation", () => {
    render(
      <SettingsDialog open onOpenChange={vi.fn()} workspaceId="01K0000000000" />
    );
    expect(screen.getByText("계정 내용")).toBeInTheDocument();
    // nav는 `워크스페이스`·`계정` 두 그룹이고 항목 이름은 그 안에서 짧다(프레임 WKSCp).
    const workspaceGroup = screen.getByRole("group", { name: "워크스페이스" });
    fireEvent.click(
      within(workspaceGroup).getByRole("button", { name: "일반" })
    );
    expect(screen.getByText("워크스페이스 내용")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "멤버" }));
    expect(screen.getByText("멤버 내용")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "연동" }));
    expect(screen.getByText("연동 내용")).toBeInTheDocument();
  });

  // 같은 이름이 두 그룹에 있다 — 팀의 허용·관리(APP-941)와 내 연결(APP-804)
  it("「외부 에이전트」는 워크스페이스 쪽이 관리, 계정 쪽이 내 연결을 연다", () => {
    render(
      <SettingsDialog open onOpenChange={vi.fn()} workspaceId="01K0000000000" />
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: "워크스페이스" })).getByRole(
        "button",
        { name: "외부 에이전트" }
      )
    );
    expect(screen.getByText("외부 에이전트 관리 내용")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("group", { name: "계정" })).getByRole("button", {
        name: "외부 에이전트",
      })
    );
    expect(
      screen.getByRole("button", { name: "토큰 요청 시작" })
    ).toBeInTheDocument();
  });
});
