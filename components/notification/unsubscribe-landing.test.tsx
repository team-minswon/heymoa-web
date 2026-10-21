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
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { UnsubscribeLanding } from "@/components/notification/unsubscribe-landing";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ status: "anonymous" }),
}));

const PATH = "*/v1/mail/unsubscribe";
const ok = (unsubscribed: boolean) =>
  HttpResponse.json({
    success: true,
    data: {
      kind: "MEETING_PAUSED_REMINDER",
      email: "al***@example.com",
      unsubscribed,
    },
    error: null,
  });
const fail = (status: number, code: string, message: string) =>
  HttpResponse.json(
    { success: false, data: null, error: { code, message, details: null } },
    { status }
  );

const requests: string[] = [];
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  requests.length = 0;
  server.events.on("request:start", ({ request }) => {
    requests.push(request.method);
  });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => server.close());

function renderLanding(token: string | null = "1.payload.sig") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <UnsubscribeLanding token={token} />
    </QueryClientProvider>
  );
}

describe("UnsubscribeLanding", () => {
  it("열기만 하면 GET 하나만 나가고 가린 이메일과 두 메일을 보인다", async () => {
    server.use(
      http.get(PATH, () => ok(false)),
      http.post(PATH, () => ok(true))
    );
    renderLanding();

    expect(await screen.findByText("al***@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "중지된 회의 메일을 받지 않을까요?" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("회의를 중지한 다음 영업일에 보내는 안내")
    ).toBeInTheDocument();
    expect(
      screen.getByText("자동 종료했을 때 보내는 안내")
    ).toBeInTheDocument();
    // 자동 종료 실행이 켜지기 전이라 일정 고지는 없다.
    expect(
      screen.getByText("초대 등 다른 메일은 그대로 받습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/일정대로 자동 종료됩니다/)).toBeNull();
    expect(requests).toEqual(["GET"]);
  });

  it("메일 끄기는 POST 한 번 뒤 저장 응답을 받아야 완료를 보인다", async () => {
    server.use(
      http.get(PATH, () => ok(false)),
      http.post(PATH, () => ok(true))
    );
    renderLanding();
    const button = await screen.findByRole("button", { name: "메일 끄기" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(
      await screen.findByRole("heading", {
        name: "중지된 회의 메일을 껐습니다",
      })
    ).toBeInTheDocument();
    expect(requests).toEqual(["GET", "POST"]);
    expect(
      screen.getByRole("button", { name: "다시 켜기" })
    ).toBeInTheDocument();
  });

  it("저장이 실패하면 완료를 보이지 않고 확인 화면에 남는다", async () => {
    server.use(
      http.get(PATH, () => ok(false)),
      http.post(PATH, () =>
        fail(429, "UNSUBSCRIBE_RATE_LIMITED", "요청이 너무 많습니다.")
      )
    );
    renderLanding();
    const button = await screen.findByRole("button", { name: "메일 끄기" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(requests).toEqual(["GET", "POST"]));
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByText("중지된 회의 메일을 껐습니다")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "중지된 회의 메일을 받지 않을까요?" })
    ).toBeInTheDocument();
  });

  it("유효하지 않은 링크·이미 꺼짐·확인 실패를 서로 다른 문구로 보인다", async () => {
    server.use(
      http.get(PATH, () =>
        fail(
          400,
          "UNSUBSCRIBE_LINK_INVALID",
          "유효하지 않은 수신거부 링크입니다."
        )
      )
    );
    const { unmount } = renderLanding();
    expect(
      await screen.findByRole("heading", { name: "유효하지 않은 링크입니다" })
    ).toBeInTheDocument();
    unmount();

    server.use(http.get(PATH, () => ok(true)));
    const second = renderLanding();
    expect(
      await screen.findByRole("heading", {
        name: "중지된 회의 메일은 이미 꺼져 있습니다",
      })
    ).toBeInTheDocument();
    second.unmount();

    server.use(
      http.get(PATH, () => fail(500, "INTERNAL_ERROR", "서버 오류입니다."))
    );
    renderLanding();
    expect(
      await screen.findByRole("heading", { name: "링크를 확인하지 못했습니다" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 시도" })
    ).toBeInTheDocument();
  });

  it("토큰이 없는 주소는 요청 없이 유효하지 않은 링크로 본다", () => {
    renderLanding(null);
    expect(
      screen.getByRole("heading", { name: "유효하지 않은 링크입니다" })
    ).toBeInTheDocument();
    expect(requests).toEqual([]);
  });
});
