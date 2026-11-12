/**
 * 결제 화면 시험. **MSW 목으로 화면을 그린 것이라 서버·PG 정합성의 증거가 아니다** — 서버 계약과의 일치는 계약 미러
 * (`openapi3.yml`)와 다음 단계의 실서버 확인이 맡는다.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

import { BillingCheckout } from "@/components/billing/billing-checkout";
import { BillingSetupResultPage } from "@/components/billing/billing-setup-result-page";
import { WorkspacePlanSettings } from "@/components/billing/plan-settings";
import { track } from "@/lib/analytics/track";
import { getGetWorkspaceBillingQueryKey } from "@/lib/api/generated/billing/billing";
import { leaveToCardRegistration } from "@/lib/billing/navigate";
import { billingHandlers, billingMock } from "@/lib/mocks/billing";
import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";

vi.mock("@/lib/billing/navigate", () => ({ leaveToCardRegistration: vi.fn() }));
vi.mock("@/lib/analytics/track", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/track")>()),
  track: vi.fn(),
}));

/** 목 시드: 집행 대상·Free / 이미 유료 / 집행 대상 아님. */
const FREE = "01K0000000000";
const PAID = "01K0000000006";

const server = setupServer(...restHandlers, ...billingHandlers);
const requests: string[] = [];
server.events.on("request:start", ({ request }) => {
  requests.push(`${request.method} ${new URL(request.url).pathname}`);
});
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  mockDb.reset();
  vi.useRealTimers();
  vi.mocked(track).mockClear();
  vi.mocked(leaveToCardRegistration).mockClear();
  requests.length = 0;
});
afterAll(() => server.close());

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
function renderIn(ui: React.ReactNode, client = newClient()) {
  const view = render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
  return {
    client,
    rerender: (next: React.ReactNode) =>
      view.rerender(
        <QueryClientProvider client={client}>{next}</QueryClientProvider>
      ),
  };
}
const envelope = (data: unknown, status = 200) =>
  HttpResponse.json({ success: true, data, error: null }, { status });
const failure = (code: string, message: string, status: number) =>
  HttpResponse.json(
    { success: false, data: null, error: { code, message, details: null } },
    { status }
  );

// ---- 응답 만들기 ----

const billingBody = (patch: Record<string, unknown> = {}) => ({
  workspaceId: FREE,
  enforced: true,
  status: "FREE",
  product: {
    agreementVersion: "A1",
    policyVersion: "P1",
    amountKrw: 9900,
    recordingAllowanceMinutes: null,
    freeRecordingAllowanceMinutes: 120,
    currency: "KRW",
    billingInterval: "MONTH",
    planCode: "PRO",
    testPaymentNotice: "SIMULATED_NO_CHARGE",
  },
  entitlement: {
    kind: "FREE",
    period: null,
    recordingAllowanceMinutes: 120,
    planCode: "FREE",
  },
  currentPeriod: null,
  cancelAtPeriodEnd: false,
  mySetupId: null,
  teamSetupInProgress: false,
  latestAttemptStatus: null,
  allowedActions: ["START_PURCHASE"],
  detail: null,
  ...patch,
});
const detail = (status = "FAILED") => ({
  methodVersion: 1,
  maskedCard: null,
  latestAttempt: {
    attemptId: "A1",
    cycleId: "C1",
    attemptNumber: 1,
    status,
    errorCode: status === "FAILED" ? "CARD_DECLINED" : null,
    requiresManualReview: false,
  },
  subscriptionVersion: 3,
  openCycleId: "C1",
  methodPayerIsMe: true,
});
const serveBilling = (patch: Record<string, unknown> = {}, id = FREE) =>
  server.use(
    http.get(`*/v1/workspaces/${id}/billing`, () =>
      envelope(billingBody({ workspaceId: id, ...patch }))
    )
  );
const asMember = () =>
  server.use(
    http.get(`*/v1/workspaces/${FREE}`, () =>
      envelope({ ...mockDb.getWorkspace(FREE), role: "MEMBER" })
    )
  );
const setupBody = (
  stage: string,
  status: string,
  extra: Record<string, unknown> = {}
) => ({
  setupId: "S1",
  workspaceId: FREE,
  purpose: "PURCHASE",
  statusUrl: "/v1/me/billing/setups/S1",
  setupStatus: "ISSUING",
  stage,
  status,
  failureCode: null,
  allowedActions: [],
  amountKrw: 9900,
  paidPeriod: null,
  latestAttempt: null,
  originAttempt: null,
  testPaymentNotice: "SIMULATED_NO_CHARGE",
  planCode: "PRO",
  provider: "TOSS",
  pollAfterSeconds: null,
  ...extra,
});
const serveSetup = (body: Record<string, unknown>) =>
  server.use(http.get("*/v1/me/billing/setups/S1", () => envelope(body)));
const resultEvents = () =>
  vi
    .mocked(track)
    .mock.calls.filter(([name]) => name === "billing_card_setup_resulted")
    .map(([, props]) => props);

// ---- 설정 › 요금제 ----

/** 설정 창의 「요금제」 탭. 「결제 관리」로 넘기는 콜백만 받는다. */
const PlanTab = ({ workspaceId }: { workspaceId: string }) => (
  <WorkspacePlanSettings workspaceId={workspaceId} onOpenPayment={vi.fn()} />
);
const startButton = () =>
  screen.queryByRole("button", { name: "Pro 시작하기" });

describe("요금제 화면", () => {
  it("ADMIN 의 Free 는 서버 값으로 상품을 그리고 구매 버튼을 준다", async () => {
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(await screen.findByText("9,900원")).toBeInTheDocument();
    expect(screen.getByText("녹음 무제한")).toBeInTheDocument();
    expect(screen.getByText("월 30시간 녹음")).toBeInTheDocument();
    expect(
      screen.getByText("이 공간의 모든 멤버가 함께 씁니다")
    ).toBeInTheDocument();
    expect(startButton()).toBeEnabled();
    expect(
      screen.getByText("시험 결제이며 실제로 청구되지 않습니다.")
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("billing_plans_viewed", {
        workspace_id: FREE,
        role: "admin",
      })
    );
  });

  it("서버가 제공량을 숫자로 줘도 깨지지 않는다", async () => {
    serveBilling({
      product: { ...billingBody().product, recordingAllowanceMinutes: 1000 },
    });
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(await screen.findByText("녹음 16시간 40분")).toBeInTheDocument();
  });

  it("멤버에게는 구매 버튼 대신 관리자에게 요청하라고 안내한다", async () => {
    asMember();
    serveBilling({ allowedActions: [], detail: null });
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByText("구매와 결제 관리는 관리자만 할 수 있습니다.")
    ).toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
  });

  it("타인의 진행 중 구매는 팀의 구독 처리 중으로만 알린다", async () => {
    serveBilling({ teamSetupInProgress: true, allowedActions: [] });
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByText(/팀의 구독 처리 중입니다/)
    ).toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
  });

  it("이미 유료면 구매 버튼 없이 다음 결제를 그린다", async () => {
    renderIn(<PlanTab workspaceId={PAID} />);
    expect(
      await screen.findByText("다음 결제 2026년 12월 11일 · 9,900원")
    ).toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
  });

  it("결과 확인 중에는 새 결제 버튼이 없다", async () => {
    serveBilling({
      latestAttemptStatus: "UNKNOWN",
      allowedActions: ["REFRESH_STATUS"],
      detail: detail("UNKNOWN"),
    });
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByText(
        "다시 결제하지 마세요. 확인이 끝나면 이 화면에 반영됩니다."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /다시 결제/ })
    ).not.toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
  });

  it("갱신 결제 결과를 기다리는 동안(GRACE)은 Pro 로 보이고 미납이라 하지 않는다", async () => {
    serveBilling({
      status: "ACTIVE",
      entitlement: {
        kind: "GRACE",
        period: {
          start: "2026-11-11T00:00:00+09:00",
          end: "2026-12-11T00:00:00+09:00",
        },
        recordingAllowanceMinutes: null,
        planCode: "PRO",
      },
      allowedActions: ["REFRESH_STATUS"],
      latestAttemptStatus: "UNKNOWN",
    });
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByText(
        "갱신 결제 결과를 확인하고 있습니다. 그동안 Pro를 그대로 씁니다."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/미납|유예/)).not.toBeInTheDocument();
    // 같은 말을 두 번 하지 않는다 — 직접 구매한 사람에게 하는 「다시 결제하지 마세요」는 갱신에 없다
    expect(screen.queryByText(/다시 결제하지 마세요/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "상태 다시 확인" })
    ).not.toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
  });

  it.each([
    [
      "UNPAID",
      "결제가 승인되지 않아 구독이 종료되었습니다. 다시 시작하려면 카드를 등록해 주세요.",
    ],
    ["EXPIRED", "해지한 구독의 이용 기간이 끝났습니다."],
    ["REFUNDED", "환불되어 구독이 종료되었습니다."],
  ])("끝난 구독(%s)은 그 까닭을 한 줄로 알린다", async (closedReason, line) => {
    serveBilling({ status: "ENDED", closedReason });
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(await screen.findByText(line)).toBeInTheDocument();
    expect(startButton()).toBeEnabled();
  });
});

describe("공간 전환 캐시", () => {
  it("다른 공간으로 바뀌면 이전 공간의 결제 정보를 한 번도 그리지 않는다", async () => {
    server.use(
      http.get(`*/v1/workspaces/${PAID}/billing`, async () => {
        await delay(150);
      })
    );
    const { rerender } = renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByRole("button", { name: "Pro 시작하기" })
    ).toBeInTheDocument();

    rerender(<PlanTab workspaceId={PAID} />);
    // 새 공간 값이 오기 전에는 skeleton 이다 — Free 공간의 구매 링크가 남아 있으면 안 된다.
    expect(startButton()).not.toBeInTheDocument();
    expect(screen.getByLabelText("요금제를 불러오는 중")).toBeInTheDocument();
    expect(
      await screen.findByText(/다음 결제 2026년 12월 11일/)
    ).toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
  });
});

describe("요금제 탭 안의 단계", () => {
  it("「Pro 시작하기」를 누르면 같은 탭이 주문 확인으로 바뀌고 「요금제」로 돌아온다", async () => {
    renderIn(<PlanTab workspaceId={FREE} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Pro 시작하기" })
    );
    expect(
      await screen.findByRole("heading", { name: "주문 확인" })
    ).toBeInTheDocument();
    expect(await screen.findByText("오늘 결제")).toBeInTheDocument();
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("billing_checkout_entered", {
        workspace_id: FREE,
        role: "admin",
      })
    );
    // 주소를 바꾸지 않는다 — 설정 창 안의 상태다.
    expect(leaveToCardRegistration).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "요금제" }));
    expect(
      await screen.findByRole("heading", { name: "요금제 비교" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "주문 확인" })
    ).not.toBeInTheDocument();
  });

  it("유료 공간의 ADMIN 은 「결제 관리」로 결제 관리 탭을 연다", async () => {
    const onOpenPayment = vi.fn();
    renderIn(
      <WorkspacePlanSettings workspaceId={PAID} onOpenPayment={onOpenPayment} />
    );
    fireEvent.click(await screen.findByRole("button", { name: "결제 관리" }));
    expect(onOpenPayment).toHaveBeenCalledTimes(1);
  });

  it("주문서에서 살 수 없는 상태면 그 안내와 「요금제로 돌아가기」만 준다", async () => {
    serveBilling({ allowedActions: [] });
    const onBack = vi.fn();
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={onBack} />
    );
    expect(
      await screen.findByText("지금은 새로 구매할 수 없는 상태입니다.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "요금제로 돌아가기" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// ---- 주문서 ----

const agree = () => screen.getByRole("checkbox");
const submit = () => screen.getByRole("button", { name: "동의하고 카드 등록" });

describe("주문서", () => {
  it("공간·상품·금액·제공량·안내를 서버 값으로 그리고 동의 전에는 구매할 수 없다", async () => {
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    await screen.findByText("테스트 유저의 워크스페이스");
    expect(screen.getByText("Pro 월 구독")).toBeInTheDocument();
    // 상품 금액과 오늘 결제 금액 두 자리 모두 서버 값이다.
    expect(screen.getAllByText("9,900원")).toHaveLength(2);
    expect(screen.getByText("녹음 무제한")).toBeInTheDocument();
    expect(
      screen.getByText("이 공간의 모든 멤버가 함께 씁니다.")
    ).toBeInTheDocument();
    expect(submit()).toBeDisabled();
    fireEvent.click(agree());
    expect(submit()).toBeEnabled();
    expect(track).toHaveBeenCalledWith("billing_agreement_accepted", {
      workspace_id: FREE,
    });
    // 체크·해제를 되풀이해도 동의 이벤트는 한 번이다.
    fireEvent.click(agree());
    fireEvent.click(agree());
    expect(
      vi
        .mocked(track)
        .mock.calls.filter(([name]) => name === "billing_agreement_accepted")
    ).toHaveLength(1);
    expect(
      screen.getByText(
        "카드 정보는 결제 대행사의 결제창에서 입력하며, HeyMoa는 카드 번호를 저장하지 않습니다."
      )
    ).toBeInTheDocument();
  });

  it("동의 체크 위에 환불 안내를 두고 약관의 환불 조항을 새 탭으로 연다(APP-1586)", async () => {
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    const link = await screen.findByRole("link", { name: "환불 규정 보기" });
    expect(link).toHaveAttribute("href", "/terms#section-13");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const notice = link.closest("p")!;
    expect(notice).toHaveTextContent(
      "결제일부터 7일 이내이고 녹음이 30시간 이하이면 전액 환불받을 수 있습니다."
    );
    // 바로 다음 형제가 자동 결제 동의 체크다.
    expect(notice.nextElementSibling).toContainElement(agree());
  });

  it.each([
    ["SIMULATED_NO_CHARGE", "시험 결제이며 실제로 청구되지 않습니다."],
    [
      "REAL_CARD_CHARGE_AUTO_CANCEL",
      "시험 결제이지만 카드가 실제로 승인된 뒤 자동 취소됩니다.",
    ],
  ])("시험 결제 안내는 서버 값(%s)을 따른다", async (notice, text) => {
    serveBilling({
      product: { ...billingBody().product, testPaymentNotice: notice },
    });
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("실결제 상품(안내 값 없음)에는 시험 결제 문구를 쓰지 않는다", async () => {
    serveBilling({
      product: { ...billingBody().product, testPaymentNotice: null },
    });
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    await screen.findByText("오늘 결제");
    expect(screen.queryByText(/시험 결제/)).not.toBeInTheDocument();
  });

  it("동의하고 시작하면 등록을 열고 카드 등록으로 이동하며 이벤트에 식별자를 싣지 않는다", async () => {
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    await screen.findByText("오늘 결제");
    fireEvent.click(agree());
    fireEvent.click(submit());
    await waitFor(() => expect(leaveToCardRegistration).toHaveBeenCalled());
    expect(vi.mocked(leaveToCardRegistration).mock.calls[0][0]).toMatch(
      /^\/billing\/setups\//
    );
    expect(track).toHaveBeenCalledWith("billing_card_setup_started", {
      workspace_id: FREE,
      provider: "FAKE",
    });
  });

  it("네트워크 실패 뒤 다시 눌러도 같은 requestKey 가 나간다", async () => {
    const keys: string[] = [];
    let calls = 0;
    server.use(
      http.post(
        `*/v1/workspaces/${FREE}/billing/setups`,
        async ({ request }) => {
          keys.push(
            ((await request.clone().json()) as { requestKey: string })
              .requestKey
          );
          calls += 1;
          if (calls === 1)
            return failure(
              "INTERNAL_ERROR",
              "잠시 후 다시 시도해 주세요.",
              500
            );
        }
      )
    );
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    await screen.findByText("오늘 결제");
    fireEvent.click(agree());
    fireEvent.click(submit());
    await waitFor(() => expect(keys).toHaveLength(1));
    await waitFor(() => expect(submit()).toBeEnabled());
    fireEvent.click(submit());
    await waitFor(() => expect(leaveToCardRegistration).toHaveBeenCalled());
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it("상태가 바뀌었다(409)면 다시 읽고 동의를 새로 받으며 새 키를 쓴다", async () => {
    const keys: string[] = [];
    let calls = 0;
    server.use(
      http.post(
        `*/v1/workspaces/${FREE}/billing/setups`,
        async ({ request }) => {
          keys.push(
            ((await request.clone().json()) as { requestKey: string })
              .requestKey
          );
          calls += 1;
          if (calls === 1)
            return failure(
              "BILLING_STATE_CHANGED",
              "상품이 바뀌었습니다.",
              409
            );
        }
      )
    );
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    await screen.findByText("오늘 결제");
    fireEvent.click(agree());
    fireEvent.click(submit());
    expect(
      await screen.findByText(/상품 또는 상태가 바뀌었습니다/)
    ).toBeInTheDocument();
    expect(agree()).toHaveAttribute("aria-checked", "false");
    expect(submit()).toBeDisabled();
    fireEvent.click(agree());
    fireEvent.click(submit());
    await waitFor(() => expect(leaveToCardRegistration).toHaveBeenCalled());
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("진행 중 등록을 돌려받으면(registration=null) 이어 갈 수 없다고 알리고 이동하지 않는다", async () => {
    server.use(
      http.post(`*/v1/workspaces/${FREE}/billing/setups`, () =>
        envelope(
          {
            setupId: "S9",
            purpose: "PURCHASE",
            status: "AUTHORIZED",
            provider: "FAKE",
            planCode: "PRO",
            amountKrw: 9900,
            currency: "KRW",
            recordingAllowanceMinutes: null,
            agreementVersion: "A1",
            testPaymentNotice: null,
            expiresAt: "2026-11-11T01:00:00+09:00",
            statusUrl: "/v1/me/billing/setups/S9",
            registration: null,
          },
          200
        )
      )
    );
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    await screen.findByText("오늘 결제");
    fireEvent.click(agree());
    fireEvent.click(submit());
    expect(
      await screen.findByText("진행 중인 카드 등록이 있습니다")
    ).toBeInTheDocument();
    expect(leaveToCardRegistration).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "진행 상황 보기" })
    ).toHaveAttribute("href", "/billing/setups/S9");
  });

  it("이미 열린 등록이 있으면 취소하고 다시 시작할 수 있다", async () => {
    await fetch(`http://localhost/v1/workspaces/${FREE}/billing/setups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestKey: "pre",
        purpose: "PURCHASE",
        expectedProductVersion: "TEST_MONTHLY_V1",
        agreementVersion: "BILLING_TEST_V1",
      }),
    });
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "취소하고 다시 시작" })
    );
    await waitFor(() =>
      expect(
        screen.queryByText("진행 중인 카드 등록이 있습니다")
      ).not.toBeInTheDocument()
    );
    expect(requests.filter((r) => r.endsWith("/cancel"))).toHaveLength(1);
    expect(submit()).toBeDisabled();
  });

  it("멤버는 주문서 대신 관리자 요청 안내를 본다", async () => {
    asMember();
    serveBilling({ allowedActions: [] });
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    expect(
      await screen.findByText(/관리자에게 요청해 주세요/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "동의하고 카드 등록" })
    ).not.toBeInTheDocument();
  });
});

// ---- 등록 결과 ----

describe("등록 결과 — 상태별 화면", () => {
  it.each([
    [
      "카드 등록 확인 중",
      setupBody("BILLING_KEY", "PROCESSING"),
      "카드 등록을 확인하는 중입니다",
    ],
    [
      "카드 등록 결과 확인 지연",
      setupBody("BILLING_KEY", "UNKNOWN"),
      "카드 등록 결과를 확인하고 있습니다",
    ],
    [
      "카드 등록 조치 필요",
      setupBody("BILLING_KEY", "ACTION_REQUIRED"),
      "이 등록으로는 결제되지 않았습니다",
    ],
    [
      "결제 확인 중",
      setupBody("PAYMENT", "PROCESSING"),
      "결제를 확인하는 중입니다",
    ],
    [
      "이용 권한 반영 중",
      setupBody("ACCESS", "PROCESSING"),
      "결제를 확인했습니다",
    ],
    ["닫힘(만료)", setupBody("CLOSED", "EXPIRED"), "카드 등록이 닫혔습니다"],
    [
      "카드 인증 전",
      setupBody("CARD_AUTH_REQUIRED", "WAITING", {
        allowedActions: ["CANCEL_SETUP"],
      }),
      "카드 등록이 끝나지 않았습니다",
    ],
  ])("%s", async (_name, body, title) => {
    serveSetup(body);
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(
      screen.getByText("시험 결제이며 실제로 청구되지 않습니다.")
    ).toBeInTheDocument();
  });

  it("결제 결과 확인 지연은 다시 결제하지 말라고 하고 새 결제 버튼 대신 문의 길만 둔다", async () => {
    serveSetup(
      setupBody("PAYMENT", "UNKNOWN", {
        allowedActions: ["REFRESH_STATUS"],
        latestAttempt: {
          attemptId: "A1",
          cycleId: "C1",
          attemptNumber: 1,
          status: "UNKNOWN",
          errorCode: null,
          requiresManualReview: false,
        },
      })
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByText(
        /결제 결과를 확인하고 있습니다. 다시 결제하지 마세요./
      )
    ).toBeInTheDocument();
    // 메뉴 없는 화면이라 나갈 길은 있어야 한다.
    expect(
      screen.getByRole("link", { name: "요금제로 돌아가기" })
    ).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/w\/[^/?]+\?settings=billing$/)
    );
    // 단추는 문의 창을 여는 링크 하나뿐이고, 결제 번호(승인 시도)를 「결제·환불」로 싣는다.
    const support = screen.getByRole("button", { name: "문의·피드백" });
    expect(screen.getAllByRole("button")).toEqual([support]);
    fireEvent.click(support);
    expect(
      await screen.findByRole("radio", { name: /결제·환불/ })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText("결제 번호 A1도 함께 보냅니다.")
    ).toBeInTheDocument();
  });

  it("결제 시도가 없는 등록의 문의 링크는 등록 번호를 싣는다", async () => {
    serveSetup(setupBody("BILLING_KEY", "ACTION_REQUIRED"));
    renderIn(<BillingSetupResultPage setupId="S1" />);
    fireEvent.click(await screen.findByRole("button", { name: "문의·피드백" }));
    expect(
      await screen.findByText("등록 번호 S1도 함께 보냅니다.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/결제 번호/)).not.toBeInTheDocument();
  });

  it("승인 뒤 자동 취소된 결제는 닫힘이 아니라 전액 취소로 알리고 새로 시작할 수 있다", async () => {
    serveSetup(
      setupBody("ACCESS", "CANCELED", {
        allowedActions: ["START_PURCHASE"],
        originAttempt: {
          attemptId: "A1",
          cycleId: "C1",
          attemptNumber: 1,
          status: "SUCCEEDED",
          errorCode: null,
          requiresManualReview: false,
          refundStatus: "SUCCEEDED",
          refundOrigin: "COMPENSATION",
        },
      })
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByText("결제가 자동으로 취소되었습니다")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("카드 등록이 닫혔습니다")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새로 시작" })).toBeInTheDocument();
  });

  it("권한을 잃었으면 상태만 알리고 새 작업을 주지 않는다", async () => {
    serveSetup(
      setupBody("ACCESS_LOST", "ACTION_REQUIRED", {
        workspaceId: null,
        amountKrw: null,
        testPaymentNotice: null,
      })
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByText(/관리자 권한이 없어 결과를 자세히 볼 수 없습니다/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("완료는 공간·금액·기간·다음 청구일을 그린다", async () => {
    serveSetup(
      setupBody("COMPLETED", "COMPLETED", {
        paidPeriod: {
          start: "2026-11-11T00:00:00+09:00",
          end: "2026-12-11T00:00:00+09:00",
        },
      })
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByText("결제가 완료되었습니다")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("테스트 유저의 워크스페이스")
    ).toBeInTheDocument();
    expect(screen.getByText("9,900원")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(
      screen.getByText("2026년 11월 11일부터 2026년 12월 11일 전까지")
    ).toBeInTheDocument();
    expect(screen.getByText("2026년 12월 11일")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "공간으로 가기" })).toHaveAttribute(
      "href",
      `/w/${FREE}`
    );
  });

  it("확정 거절은 같은 카드로 다시 결제하지 않고 카드 등록부터 새로 시작하게 한다", async () => {
    serveSetup(
      setupBody("PAYMENT", "DECLINED", { allowedActions: ["START_PURCHASE"] })
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByText("결제가 승인되지 않았습니다")
    ).toBeInTheDocument();
    expect(screen.getByText(/카드를 다시 등록해 주세요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새로 시작" })).toHaveAttribute(
      "href",
      `/w/${FREE}?settings=billing`
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("서버가 새 구매를 허용하지 않으면 거절 안내만 그린다", async () => {
    serveSetup(setupBody("PAYMENT", "DECLINED", { allowedActions: [] }));
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByText("결제가 승인되지 않았습니다")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "새로 시작" })
    ).not.toBeInTheDocument();
  });

  it("남의 등록이거나 없으면 찾을 수 없다고 알린다", async () => {
    server.use(
      http.get("*/v1/me/billing/setups/S1", () =>
        failure("BILLING_SETUP_NOT_FOUND", "카드 등록을 찾을 수 없습니다.", 404)
      )
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByText("카드 등록을 찾을 수 없습니다")
    ).toBeInTheDocument();
  });
});

describe("등록 결과 — 완료 맡기기·다시 읽기·이벤트·캐시", () => {
  it("인증을 마친 등록은 화면에 들어오면 완료를 한 번만 맡기고 목 흐름을 따라 완료된다", async () => {
    billingMock.setScenario("ok");
    const created = await fetch(
      `http://localhost/v1/workspaces/${FREE}/billing/setups`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: "k",
          purpose: "PURCHASE",
          expectedProductVersion: "TEST_MONTHLY_V1",
          agreementVersion: "BILLING_TEST_V1",
        }),
      }
    );
    const { setupId } = (await created.json()).data;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderIn(<BillingSetupResultPage setupId={setupId} />);
    await waitFor(() =>
      expect(requests.filter((r) => r.endsWith("/complete"))).toHaveLength(1)
    );
    for (let i = 0; i < 5; i += 1)
      await act(() => vi.advanceTimersByTimeAsync(2100));
    expect(
      await screen.findByText("결제가 완료되었습니다")
    ).toBeInTheDocument();
    expect(requests.filter((r) => r.endsWith("/complete"))).toHaveLength(1);
    expect(resultEvents()).toEqual([
      { workspace_id: FREE, provider: "FAKE", result: "completed" },
    ]);
  });

  it("2분 뒤 자동 읽기를 멈추고, 다시 확인과 창 포커스 복귀로 한 번씩 읽는다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let reads = 0;
    server.use(
      http.get("*/v1/me/billing/setups/S1", () => {
        reads += 1;
        return envelope(setupBody("PAYMENT", "PROCESSING"));
      })
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    await screen.findByText("결제를 확인하는 중입니다");
    expect(reads).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(2100)); // 최초 2초
    expect(reads).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(5100)); // 이후 5초
    expect(reads).toBe(3);

    await act(() => vi.advanceTimersByTimeAsync(125_000));
    const stopped = reads;
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(reads).toBe(stopped);
    expect(screen.getByText(/자동 확인을 멈췄습니다/)).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(reads).toBe(stopped + 1));

    fireEvent.click(screen.getByRole("button", { name: "다시 확인" }));
    await waitFor(() => expect(reads).toBe(stopped + 2));
  });

  it("서버가 알려 준 간격(pollAfterSeconds)을 우선한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let reads = 0;
    server.use(
      http.get("*/v1/me/billing/setups/S1", () => {
        reads += 1;
        return envelope(
          setupBody("PAYMENT", "PROCESSING", { pollAfterSeconds: 10 })
        );
      })
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    await screen.findByText("결제를 확인하는 중입니다");
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(reads).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(reads).toBe(2);
  });

  it("결과 이벤트는 최종 상태가 처음 보일 때 한 번만 나가고 식별자를 싣지 않는다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let reads = 0;
    server.use(
      http.get("*/v1/me/billing/setups/S1", () => {
        reads += 1;
        return envelope(
          reads <= 3
            ? setupBody("PAYMENT", "UNKNOWN", { pollAfterSeconds: 1 })
            : setupBody("COMPLETED", "COMPLETED", {
                paidPeriod: {
                  start: "2026-11-11T00:00:00+09:00",
                  end: "2026-12-11T00:00:00+09:00",
                },
              })
        );
      })
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    await screen.findByText("결제 결과 확인이 지연되고 있습니다");
    for (let i = 0; i < 4; i += 1)
      await act(() => vi.advanceTimersByTimeAsync(1100));
    await screen.findByText("결제가 완료되었습니다");
    expect(resultEvents()).toEqual([
      { workspace_id: FREE, provider: "TOSS", result: "unknown" },
      { workspace_id: FREE, provider: "TOSS", result: "completed" },
    ]);
    expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toMatch(
      /S1|authKey|state/
    );
  });

  it("상태가 바뀌면 그 공간의 결제 조회만 다시 읽게 한다", async () => {
    serveSetup(
      setupBody("COMPLETED", "COMPLETED", {
        paidPeriod: {
          start: "2026-11-11T00:00:00+09:00",
          end: "2026-12-11T00:00:00+09:00",
        },
      })
    );
    const client = newClient();
    for (const id of [FREE, PAID])
      client.setQueryData(getGetWorkspaceBillingQueryKey(id), {
        status: 200,
        data: {},
      });
    renderIn(<BillingSetupResultPage setupId="S1" />, client);
    await screen.findByText("결제가 완료되었습니다");
    await waitFor(() =>
      expect(
        client.getQueryState(getGetWorkspaceBillingQueryKey(FREE))
          ?.isInvalidated
      ).toBe(true)
    );
    expect(
      client.getQueryState(getGetWorkspaceBillingQueryKey(PAID))?.isInvalidated
    ).toBe(false);
  });
});
