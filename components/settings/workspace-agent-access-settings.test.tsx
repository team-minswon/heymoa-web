import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { WorkspaceAgentAccessSettings } from "@/components/settings/workspace-agent-access-settings";
import { mockDb } from "@/lib/mocks/db";
import { MOCK_USER } from "@/lib/mocks/mock-user";
import { restHandlers } from "@/lib/mocks/rest-handlers";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: MOCK_USER }),
}));

/** 목 시드의 첫 워크스페이스. 목 유저가 ADMIN 이고, 목 유저와 다른 멤버의 연결이 하나씩 살아 있다. */
const WORKSPACE_ID = "01K0000000000";

/** 실제 계약 경로를 그대로 지난다 — 끄기·끊기가 정말 나갔는지, 취소하면 안 나갔는지를 요청으로 본다. */
const server = setupServer(...restHandlers);
const requests: string[] = [];
server.events.on("request:start", async ({ request }) => {
  const { pathname } = new URL(request.url);
  const body =
    request.method === "PUT" ? ` ${await request.clone().text()}` : "";
  requests.push(`${request.method} ${pathname}${body}`);
});

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  mockDb.reset();
  requests.length = 0;
});
afterAll(() => server.close());

const ACCESS = `/v1/workspaces/${WORKSPACE_ID}/agent-access`;
const ADMIN_LIST = `GET /v1/workspaces/${WORKSPACE_ID}/agent-delegations`;

function renderSettings(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  })
) {
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceAgentAccessSettings workspaceId={WORKSPACE_ID} />
    </QueryClientProvider>
  );
}

/** 멤버 목록에서 목 유저의 역할만 바꿔 내린다 — 역할 판정이 이 목록을 본다. */
function asRole(role: "ADMIN" | "MEMBER") {
  server.use(
    http.get(`*/v1/workspaces/${WORKSPACE_ID}/members`, () =>
      HttpResponse.json({
        success: true,
        data: {
          members: mockDb
            .listMembers(WORKSPACE_ID)
            .map((member) =>
              member.userId === MOCK_USER.userId ? { ...member, role } : member
            ),
        },
        error: null,
      })
    )
  );
}

const toggle = () =>
  screen.findByRole("switch", { name: "외부 에이전트 연결 허용" });
const list = () => screen.findByRole("region", { name: "열린 연결" });

describe("워크스페이스 외부 에이전트 관리", () => {
  it("ADMIN 에게 허용 토글과 열린 연결 목록을 보이고, 행에는 이름·자격 종류·맡긴 사람·연결·마지막 사용만 있다", async () => {
    renderSettings();

    expect((await toggle()).getAttribute("aria-checked")).toBe("true");
    const region = await list();
    const rows = await within(region).findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    // 최근에 연결한 것부터
    const [jiwon, mine] = rows;
    expect(within(jiwon).getByText("지원의 Codex")).toBeTruthy();
    expect(within(jiwon).getByText("OAuth")).toBeTruthy();
    expect(within(jiwon).getByText("한지원")).toBeTruthy();
    expect(within(jiwon).getByText(/아직 안 씀/)).toBeTruthy();
    expect(within(mine).getByText("노트북 Claude Code")).toBeTruthy();
    expect(within(mine).getByText("개인 토큰")).toBeTruthy();
    expect(within(mine).getByText(MOCK_USER.name)).toBeTruthy();
    // 사용 내역·토큰 앞자리는 관리자에게 보이지 않는다
    expect(within(region).queryByText(/hm_/)).toBeNull();
    expect(within(region).queryByText("사용 내역")).toBeNull();
  });

  it("끄기는 연결 수가 적힌 확인을 거쳐 나가고, 취소하면 아무 요청도 가지 않는다", async () => {
    renderSettings();
    await within(await list()).findAllByRole("listitem");

    fireEvent.click(await toggle());
    let dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(
      "지금 연결된 2개가 모두 끊기고, 다시 켜도 되살아나지 않습니다. 끈 동안은 누구도 이 워크스페이스로 연결할 수 없습니다."
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(requests.filter((line) => line.startsWith("PUT"))).toEqual([]);

    fireEvent.click(await toggle());
    dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "끄기" }));

    expect(await screen.findByText("열린 연결이 없습니다.")).toBeTruthy();
    expect(requests).toContain(`PUT ${ACCESS} {"allowed":false}`);
    await waitFor(async () =>
      expect((await toggle()).getAttribute("aria-checked")).toBe("false")
    );
    expect(screen.getByText("꺼짐 — 새 연결을 만들 수 없습니다.")).toBeTruthy();
    // ADMIN 본인의 연결도 같은 사유로 끊긴다
    expect(
      mockDb
        .listAgentDelegations()
        .find((delegation) => delegation.delegationId === "01K00000000Q1")
        ?.revokeReason
    ).toBe("AGENT_ACCESS_DISABLED");
  });

  it("켜기는 확인 없이 바로 나간다", async () => {
    mockDb.changeWorkspaceAgentAccess(WORKSPACE_ID, false);
    renderSettings();

    const off = await toggle();
    expect(off.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(off);

    await waitFor(() =>
      expect(requests).toContain(`PUT ${ACCESS} {"allowed":true}`)
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(async () =>
      expect((await toggle()).getAttribute("aria-checked")).toBe("true")
    );
  });

  it("끊기는 이름과 맡긴 사람을 보이는 확인을 거쳐 나가고 목록을 다시 읽는다", async () => {
    renderSettings();
    const [jiwon] = await within(await list()).findAllByRole("listitem");

    fireEvent.click(within(jiwon).getByRole("button", { name: "끊기" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("「지원의 Codex」 연결을 끊을까요?")
    ).toBeTruthy();
    expect(dialog.textContent).toContain("한지원 님이 맡긴 연결입니다.");
    fireEvent.click(within(dialog).getByRole("button", { name: "끊기" }));

    await waitFor(() => expect(screen.queryByText("지원의 Codex")).toBeNull());
    expect(requests).toContain(
      `DELETE /v1/workspaces/${WORKSPACE_ID}/agent-delegations/01K00000000Q4`
    );
    expect(requests.filter((line) => line === ADMIN_LIST)).toHaveLength(2);
  });

  // 계정 탭·다른 팀원·다른 창에서 바뀌는 목록이다 — 앱의 staleTime(60초) 안에 돌아와도 다시 읽는다
  it("관리 화면을 다시 열면 관리자 목록을 다시 읽는다", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    const first = renderSettings(client);
    await within(await list()).findAllByRole("listitem");
    first.unmount();

    renderSettings(client);
    await waitFor(() =>
      expect(requests.filter((line) => line === ADMIN_LIST)).toHaveLength(2)
    );
  });

  it("다시 읽다 실패하면 캐시가 남아 있어도 옛 목록 대신 실패와 재시도를 보인다", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    const first = renderSettings(client);
    await within(await list()).findAllByRole("listitem");
    first.unmount();
    server.use(
      http.get(`*/v1/workspaces/${WORKSPACE_ID}/agent-delegations`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "x",
              details: null,
            },
          },
          { status: 500 }
        )
      )
    );

    renderSettings(client);

    expect(
      await screen.findByText("연결 목록을 불러오지 못했습니다.")
    ).toBeTruthy();
    expect(screen.queryByText("지원의 Codex")).toBeNull();
  });

  // 다른 관리자가 끈 것을 모르고 「켜짐」을 보면, 켜려고 눌러도 끄기 확인창이 열린다
  it("관리 화면을 다시 열면 허용 상태도 다시 읽는다", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    const first = renderSettings(client);
    expect((await toggle()).getAttribute("aria-checked")).toBe("true");
    first.unmount();
    mockDb.changeWorkspaceAgentAccess(WORKSPACE_ID, false);

    renderSettings(client);

    await waitFor(async () =>
      expect((await toggle()).getAttribute("aria-checked")).toBe("false")
    );
  });

  it("MEMBER 에게는 켜짐·꺼짐과 안내만 보이고 관리자 목록을 부르지 않는다", async () => {
    asRole("MEMBER");
    renderSettings();

    expect(
      await screen.findByText("외부 에이전트 연결은 관리자만 바꿀 수 있습니다.")
    ).toBeTruthy();
    expect(screen.getByText("켜짐")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("region", { name: "열린 연결" })).toBeNull();
    expect(screen.queryByRole("button", { name: "끊기" })).toBeNull();
    expect(requests).not.toContain(ADMIN_LIST);
  });

  it("역할을 모르는 동안에는 관리 UI 를 그리지 않는다", async () => {
    server.use(
      http.get(`*/v1/workspaces/${WORKSPACE_ID}/members`, async () => {
        await delay("infinite");
        return HttpResponse.json({});
      })
    );
    renderSettings();

    expect(await screen.findByText("켜짐")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("region", { name: "열린 연결" })).toBeNull();
    expect(
      screen.queryByText("외부 에이전트 연결은 관리자만 바꿀 수 있습니다.")
    ).toBeNull();
    expect(requests).not.toContain(ADMIN_LIST);
  });
});
