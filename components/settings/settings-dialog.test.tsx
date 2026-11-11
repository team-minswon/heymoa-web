import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onTrack } from "@/lib/analytics/track";
import { SettingsDialog as ControlledDialog } from "@/components/settings/settings-dialog";
import type { SettingsSection } from "@/lib/workspace/settings-url";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "heymoaDesktop");
});

const notices = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/ui/toast", () => ({ toast: notices }));
afterEach(() => vi.clearAllMocks());

// 열린 탭은 주소가 들고 있는 값이라 셸이 내려준다 — 여기서는 상태 하나로 그 자리를 대신한다.
function SettingsDialog({
  initialSection = "account",
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSection;
  workspaceId: string;
}) {
  const [section, setSection] = useState(initialSection);
  return (
    <ControlledDialog
      {...props}
      section={section}
      onSectionChange={setSection}
    />
  );
}

// 요금제 탭 둘은 공간 요금제 조회의 `enforced` 로 보인다. 시험마다 조회 결과를 바꿔 끼운다.
const billingQuery = vi.hoisted(() => ({
  current: {
    isPending: false,
    data: {
      status: 200,
      data: { success: true, data: { enforced: true } },
    } as unknown,
  },
}));
vi.mock("@/lib/api/generated/billing/billing", () => ({
  useGetWorkspaceBilling: () => billingQuery.current,
}));
const serveEnforced = (enforced: boolean | null) => {
  billingQuery.current =
    enforced === null
      ? { isPending: true, data: undefined }
      : {
          isPending: false,
          data: { status: 200, data: { success: true, data: { enforced } } },
        };
};

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
vi.mock("@/components/settings/guests-settings", () => ({
  GuestsSettings: () => <p>임시 참여자 내용</p>,
}));
vi.mock("@/components/terms/workspace-terms-settings", () => ({
  WorkspaceTermsSettings: () => <p>용어 사전 내용</p>,
}));
vi.mock("@/components/settings/workspace-integrations-settings", () => ({
  WorkspaceIntegrationsSettings: () => <p>연동 내용</p>,
}));
vi.mock("@/components/settings/workspace-agent-access-settings", () => ({
  WorkspaceAgentAccessSettings: () => <p>외부 에이전트 관리 내용</p>,
}));
vi.mock("@/components/billing/plan-settings", () => ({
  WorkspacePlanSettings: ({ onOpenPayment }: { onOpenPayment: () => void }) => (
    <button type="button" onClick={onOpenPayment}>
      요금제 내용
    </button>
  ),
}));
vi.mock("@/components/billing/payment-settings", () => ({
  WorkspacePaymentSettings: ({ onOpenPlans }: { onOpenPlans: () => void }) => (
    <button type="button" onClick={onOpenPlans}>
      결제 관리 내용
    </button>
  ),
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
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "heymoaDesktop");
    serveEnforced(true);
  });
  it("탭 선택을 한 번 기록하고 같은 탭·리렌더는 세지 않습니다", () => {
    const heard = vi.fn();
    const unsubscribe = onTrack(heard);
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      workspaceId: "01K0000000000",
    };
    try {
      const { rerender } = render(<SettingsDialog {...props} />);
      expect(heard).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "멤버" }));
      fireEvent.click(screen.getByRole("button", { name: "멤버" }));
      rerender(<SettingsDialog {...props} />);
      expect(heard.mock.calls).toEqual([
        [
          "settings_tab_opened",
          {
            workspace_id: props.workspaceId,
            section: "members",
            from: "settings",
          },
        ],
      ]);
    } finally {
      unsubscribe();
    }
  });

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
    // 임시 참여자는 멤버 탭 아래가 아니라 자기 탭이다
    fireEvent.click(screen.getByRole("button", { name: "임시 참여자" }));
    expect(screen.getByText("임시 참여자 내용")).toBeInTheDocument();
    // 용어 사전은 임시 참여자 다음 탭이다(APP-1189)
    fireEvent.click(screen.getByRole("button", { name: "용어 사전" }));
    expect(screen.getByText("용어 사전 내용")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "연동" }));
    expect(screen.getByText("연동 내용")).toBeInTheDocument();
    // 요금제·결제 관리는 워크스페이스 그룹의 두 탭이다(PRO-75). 결제 내역은 결제 관리 안에 있어 따로 탭이 없다.
    fireEvent.click(
      within(workspaceGroup).getByRole("button", { name: "요금제" })
    );
    expect(screen.getByText("요금제 내용")).toBeInTheDocument();
    fireEvent.click(
      within(workspaceGroup).getByRole("button", { name: "결제 관리" })
    );
    expect(screen.getByText("결제 관리 내용")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "결제 내역" })
    ).not.toBeInTheDocument();
  });

  it("요금제 탭과 결제 관리 탭은 서로의 탭으로 넘어간다", () => {
    render(
      <SettingsDialog open onOpenChange={vi.fn()} workspaceId="01K0000000000" />
    );
    const workspaceGroup = screen.getByRole("group", { name: "워크스페이스" });
    fireEvent.click(
      within(workspaceGroup).getByRole("button", { name: "요금제" })
    );
    fireEvent.click(screen.getByRole("button", { name: "요금제 내용" }));
    expect(screen.getByText("결제 관리 내용")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "결제 관리 내용" }));
    expect(screen.getByText("요금제 내용")).toBeInTheDocument();
  });

  // 같은 말에 누구 것인지를 붙여 가른다 — 팀의 허용·관리(APP-941)와 내 연결(APP-804)
  it("워크스페이스 쪽 「MCP 연결」는 관리, 계정 쪽 「내 MCP 연결」은 내 연결을 연다", () => {
    render(
      <SettingsDialog open onOpenChange={vi.fn()} workspaceId="01K0000000000" />
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: "워크스페이스" })).getByRole(
        "button",
        { name: "MCP 연결" }
      )
    );
    expect(screen.getByText("외부 에이전트 관리 내용")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("group", { name: "계정" })).getByRole("button", {
        name: "내 MCP 연결",
      })
    );
    expect(
      screen.getByRole("button", { name: "토큰 요청 시작" })
    ).toBeInTheDocument();
  });

  it.each([
    ["대상이 아닌 공간", false],
    ["조회가 끝나기 전", null],
  ])("%s에는 요금제·결제 관리 탭이 없다", (_name, enforced) => {
    serveEnforced(enforced);
    render(
      <SettingsDialog open onOpenChange={vi.fn()} workspaceId="01K0000000000" />
    );
    const workspaceGroup = screen.getByRole("group", { name: "워크스페이스" });
    expect(
      within(workspaceGroup).queryByRole("button", { name: "요금제" })
    ).not.toBeInTheDocument();
    expect(
      within(workspaceGroup).queryByRole("button", { name: "결제 관리" })
    ).not.toBeInTheDocument();
  });

  it.each(["billing", "payment"] as const)(
    "대상이 아닌 공간에서 %s 탭으로 들어오면 기본 탭으로 보낸다",
    (initialSection) => {
      serveEnforced(false);
      render(
        <SettingsDialog
          open
          onOpenChange={vi.fn()}
          initialSection={initialSection}
          workspaceId="01K0000000000"
        />
      );
      expect(screen.getByText("워크스페이스 내용")).toBeInTheDocument();
      expect(screen.queryByText("요금제 내용")).not.toBeInTheDocument();
      expect(screen.queryByText("결제 관리 내용")).not.toBeInTheDocument();
    }
  );

  it("조회가 끝나기 전에는 요금제 탭으로 들어와도 기본 탭으로 보내지 않고 내용도 그리지 않는다", () => {
    serveEnforced(null);
    render(
      <SettingsDialog
        open
        onOpenChange={vi.fn()}
        initialSection="billing"
        workspaceId="01K0000000000"
      />
    );
    expect(screen.queryByText("요금제 내용")).not.toBeInTheDocument();
    expect(screen.queryByText("워크스페이스 내용")).not.toBeInTheDocument();
  });
});

function desktopWithPreferences() {
  const openPreferences = vi.fn(async () => {});
  Object.assign(window, {
    heymoaDesktop: {
      openPreferences,
      getUpdateState: async () => ({
        currentVersion: "0.1.6",
        status: "current",
        automatic: true,
        canRestart: false,
      }),
      checkForUpdates: vi.fn(),
      setAutomaticUpdates: vi.fn(),
      restartForUpdate: vi.fn(),
      subscribeUpdates: () => () => {},
    },
  });
  return openPreferences;
}
it("새 앱은 웹 설정에 앱 업데이트 메뉴를 중복해서 표시하지 않습니다", async () => {
  const openPreferences = desktopWithPreferences();
  render(
    <SettingsDialog open onOpenChange={vi.fn()} workspaceId="01K0000000000" />
  );
  expect(screen.queryByRole("button", { name: "앱 업데이트" })).toBeNull();
  expect(screen.getByText("계정 내용")).toBeVisible();
  expect(openPreferences).not.toHaveBeenCalled();
});
it("예전 업데이트 주소는 빈 화면 없이 설정 안내를 한 번 표시하고 클릭으로 엽니다", async () => {
  const openPreferences = desktopWithPreferences();
  const close = vi.fn();
  render(
    <StrictMode>
      <SettingsDialog
        open
        onOpenChange={close}
        initialSection="appUpdates"
        workspaceId="01K0000000000"
      />
    </StrictMode>
  );
  await waitFor(() => expect(notices.info).toHaveBeenCalledOnce());
  expect(openPreferences).not.toHaveBeenCalled();
  const action = notices.info.mock.calls[0][1].action;
  action.onClick();
  await waitFor(() => expect(openPreferences).toHaveBeenCalledOnce());
  expect(close).toHaveBeenCalledWith(false);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("메뉴 막대 설정 열기")).toBeNull();
});

it("네이티브 설정의 동기 오류도 화면을 무너뜨리지 않고 알립니다", async () => {
  const openPreferences = desktopWithPreferences();
  openPreferences.mockImplementation(() => {
    throw new Error("USER_GESTURE_REQUIRED");
  });
  render(
    <SettingsDialog
      open
      onOpenChange={vi.fn()}
      initialSection="appUpdates"
      workspaceId="01K0000000000"
    />
  );
  await waitFor(() => expect(notices.info).toHaveBeenCalledOnce());
  notices.info.mock.calls[0][1].action.onClick();
  await waitFor(() => expect(notices.error).toHaveBeenCalledOnce());
});
