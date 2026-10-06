import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
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

import {
  AgentOAuthConsent,
  isNavigableRedirect,
} from "@/components/agent-connections/agent-oauth-consent";
import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";

// jsdom 은 실제 이동을 구현하지 않아 location.assign 이 "Not implemented" 로 터진다.
const assign = vi.fn();
Object.defineProperty(window, "location", {
  configurable: true,
  value: {
    assign,
    get href() {
      return document.URL;
    },
    get origin() {
      return new URL(document.URL).origin;
    },
  },
});

/** 목 동의 화면이 잇는 실제 계약 경로를 그대로 지난다 — 404 봉투가 오류 코드로 읽히는지까지 본다. */
const server = setupServer(...restHandlers);
const approved: unknown[] = [];
const denied: unknown[] = [];
server.events.on("request:start", async ({ request }) => {
  if (request.method !== "POST") return;
  const body = await request.clone().json();
  if (request.url.endsWith("/consent/approve")) approved.push(body);
  if (request.url.endsWith("/consent/deny")) denied.push(body);
});

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  mockDb.reset();
  assign.mockClear();
  approved.length = 0;
  denied.length = 0;
});
afterAll(() => server.close());

function withWorkspaces(
  workspaces: Array<{ workspaceId: string; name: string }>
) {
  const all = mockDb.listWorkspaces();
  server.use(
    http.get("*/v1/workspaces", () =>
      HttpResponse.json({
        success: true,
        data: {
          workspaces: workspaces.map((workspace, index) => ({
            ...all[index % all.length],
            ...workspace,
          })),
        },
        error: null,
      })
    )
  );
}

function renderConsent(consentState = "mock-consent") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgentOAuthConsent consentState={consentState} />
    </QueryClientProvider>
  );
}

describe("외부 에이전트 연결 동의 화면", () => {
  it("에이전트 이름·확인 안 된 앱 표시·돌아갈 호스트·권한·전사 알림을 보인다", async () => {
    renderConsent();

    expect(await screen.findByRole("heading", { name: "Codex" })).toBeTruthy();
    expect(screen.getByText("HeyMoa 가 확인한 앱이 아닙니다")).toBeTruthy();
    expect(
      screen.getByText("허락하면 127.0.0.1:1455 로 돌아갑니다")
    ).toBeTruthy();
    expect(screen.getByText("읽기")).toBeTruthy();
    expect(
      screen.getByText("회의 전사(참석자의 발화와 이름)도 에이전트가 읽습니다.")
    ).toBeTruthy();
  });

  it("워크스페이스가 하나면 미리 골라 허락하면 그 워크스페이스로 보내고 돌아갈 주소로 간다", async () => {
    const [only] = mockDb.listWorkspaces();
    withWorkspaces([{ workspaceId: only.workspaceId, name: "제품팀" }]);
    renderConsent();

    const allow = await screen.findByRole("button", { name: "허락" });
    await waitFor(() => expect(allow.hasAttribute("disabled")).toBe(false));
    fireEvent.click(allow);

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(approved).toEqual([
      { state: "mock-consent", workspaceId: only.workspaceId },
    ]);
    const target = new URL(assign.mock.calls[0][0]);
    expect(target.host).toBe("127.0.0.1:1455");
    expect(target.searchParams.get("state")).toBe("mock-consent");
    expect(target.searchParams.get("code")).toBeTruthy();
  });

  it("워크스페이스가 둘 이상이면 고르기 전에는 허락할 수 없다", async () => {
    const [first, second] = mockDb.listWorkspaces();
    withWorkspaces([
      { workspaceId: first.workspaceId, name: "제품팀" },
      { workspaceId: second.workspaceId, name: "영업팀" },
    ]);
    renderConsent();

    await screen.findByRole("heading", { name: "Codex" });
    await screen.findByRole("combobox", { name: "맡길 워크스페이스" });
    expect(
      screen.getByRole("button", { name: "허락" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("워크스페이스가 없으면 허락 없이 거절만 둔다", async () => {
    withWorkspaces([]);
    renderConsent();

    expect(
      await screen.findByText("연결할 워크스페이스가 없습니다.")
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "허락" })).toBeNull();
    expect(screen.getByRole("button", { name: "거절" })).toBeTruthy();
  });

  it("거절하면 아무 워크스페이스도 보내지 않고 거절이 붙은 돌아갈 주소로 간다", async () => {
    renderConsent();

    const reject = await screen.findByRole("button", { name: "거절" });
    await waitFor(() => expect(reject.hasAttribute("disabled")).toBe(false));
    fireEvent.click(reject);

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(denied).toEqual([{ state: "mock-consent" }]);
    expect(approved).toEqual([]);
    expect(new URL(assign.mock.calls[0][0]).searchParams.get("error")).toBe(
      "access_denied"
    );
  });

  it("허락이 실패한 뒤 거절이 끝난 요청을 받으면 앞의 실패를 두지 않고 다시 연결 안내로 넘어간다", async () => {
    const [only] = mockDb.listWorkspaces();
    withWorkspaces([{ workspaceId: only.workspaceId, name: "제품팀" }]);
    server.use(
      http.post("*/v1/agent-oauth/consent/approve", () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "WORKSPACE_NOT_FOUND",
              message: "워크스페이스를 찾을 수 없습니다.",
              details: null,
            },
          },
          { status: 404 }
        )
      ),
      http.post("*/v1/agent-oauth/consent/deny", () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "AGENT_OAUTH_REQUEST_NOT_FOUND",
              message:
                "연결 요청을 찾을 수 없습니다. 에이전트에서 다시 연결해 주세요.",
              details: null,
            },
          },
          { status: 404 }
        )
      )
    );
    renderConsent();

    const allow = await screen.findByRole("button", { name: "허락" });
    await waitFor(() => expect(allow.hasAttribute("disabled")).toBe(false));
    fireEvent.click(allow);
    expect(
      await screen.findByText("워크스페이스를 찾을 수 없습니다.")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "거절" }));

    expect(
      await screen.findByText(
        "연결 요청을 찾을 수 없습니다. 에이전트에서 다시 연결해 주세요."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "허락" })).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("없거나 이미 처리된 요청이면 server 문구로 다시 연결하라고 안내한다", async () => {
    renderConsent("no-such-state");

    expect(
      await screen.findByText(
        "연결 요청을 찾을 수 없습니다. 에이전트에서 다시 연결해 주세요."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "허락" })).toBeNull();
  });

  it("돌아갈 주소는 http·https 일 때만 따라간다", () => {
    expect(isNavigableRedirect("http://127.0.0.1:1455/callback?code=a")).toBe(
      true
    );
    expect(isNavigableRedirect("https://claude.ai/api/mcp/auth_callback")).toBe(
      true
    );
    expect(isNavigableRedirect("javascript:alert(1)")).toBe(false);
    expect(isNavigableRedirect("not a url")).toBe(false);
  });
});
