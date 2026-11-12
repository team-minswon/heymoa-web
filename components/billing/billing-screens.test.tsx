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

import { BillingCardEntryPage } from "@/components/billing/billing-card-entry-page";
import { BillingCheckout } from "@/components/billing/billing-checkout";
import { BillingSetupResultPage } from "@/components/billing/billing-setup-result-page";
import { WorkspacePlanSettings } from "@/components/billing/plan-settings";
import { track } from "@/lib/analytics/track";
import { getGetWorkspaceBillingQueryKey } from "@/lib/api/generated/billing/billing";
import {
  goToCardEntry,
  goToSetupResult,
  replaceWithSetupResult,
} from "@/lib/billing/navigate";
import { billingHandlers, billingMock } from "@/lib/mocks/billing";
import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";

vi.mock("@/lib/billing/navigate", () => ({
  goToCardEntry: vi.fn(),
  goToSetupResult: vi.fn(),
  replaceWithSetupResult: vi.fn(),
}));
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
  vi.mocked(goToSetupResult).mockClear();
  vi.mocked(goToCardEntry).mockClear();
  vi.mocked(replaceWithSetupResult).mockClear();
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
    amountKrw: 24900,
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
  amountKrw: 24900,
  paidPeriod: null,
  latestAttempt: null,
  originAttempt: null,
  testPaymentNotice: "SIMULATED_NO_CHARGE",
  planCode: "PRO",
  provider: "NICEPAY",
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
    expect(await screen.findByText("24,900원")).toBeInTheDocument();
    expect(screen.getByText("녹음 무제한")).toBeInTheDocument();
    expect(screen.getByText("녹음 월 20시간")).toBeInTheDocument();
    // 두 카드가 같은 줄 구성이다 — 한 줄 설명, 멤버, 같은 다섯 기능(APP-1596).
    expect(
      screen.getByText("회의가 많지 않은 팀에 충분합니다")
    ).toBeInTheDocument();
    expect(
      screen.getByText("회의가 많은 팀이 시간 걱정 없이 씁니다")
    ).toBeInTheDocument();
    expect(screen.getAllByText("멤버 수 제한 없음")).toHaveLength(2);
    expect(screen.getAllByText("모든 기능 포함")).toHaveLength(2);
    for (const feature of [
      "실시간 회의록과 요약",
      "화자 구분",
      "회의 간 연결",
      "에이전트 채팅",
      "외부 도구와 MCP 연결",
    ])
      expect(screen.getAllByText(feature)).toHaveLength(2);
    // 워크스페이스 단위·자동 결제는 항목이 아니라 카드 아래 안내다.
    expect(
      screen.queryByText("이 워크스페이스의 모든 멤버가 함께 씁니다")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "요금은 워크스페이스 단위입니다. 관리자 한 명이 결제하면 모든 멤버가 함께 씁니다."
      )
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
      await screen.findByText(/이 워크스페이스의 구독을 처리하고 있습니다/)
    ).toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
  });

  it("이미 유료면 구매 버튼 없이 다음 결제를 그린다", async () => {
    renderIn(<PlanTab workspaceId={PAID} />);
    expect(
      await screen.findByText("다음 결제 2026년 12월 11일 · 24,900원")
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

  it("갱신 결제 결과를 기다리는 동안(RENEWAL_PENDING)은 Pro 로 보이고 미납이라 하지 않는다", async () => {
    serveBilling({
      status: "ACTIVE",
      entitlement: {
        kind: "RENEWAL_PENDING",
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

  it("운영자 환불(OPERATOR)은 보상 취소가 아니라 「환불 처리 중」으로 알린다", async () => {
    serveBilling({
      status: "ACTIVE",
      allowedActions: [],
      detail: {
        ...detail("SUCCEEDED"),
        latestAttempt: null,
        refundedAttempt: {
          ...detail("SUCCEEDED").latestAttempt,
          refundStatus: "PROCESSING",
          refundOrigin: "OPERATOR",
        },
      },
    });
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByText("환불을 처리하고 있습니다")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("결제를 취소하고 있습니다")
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      "UNPAID",
      "결제가 승인되지 않아 구독이 종료되었습니다. 다시 시작하려면 카드를 등록해 주세요.",
    ],
    ["EXPIRED", "구독의 이용 기간이 끝났습니다."],
    ["REFUNDED", "환불되어 구독이 종료되었습니다."],
  ])("끝난 구독(%s)은 그 까닭을 한 줄로 알린다", async (closedReason, line) => {
    serveBilling({ status: "ENDED", closedReason });
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(await screen.findByText(line)).toBeInTheDocument();
    expect(startButton()).toBeEnabled();
    expect(
      screen.queryByText("지금은 새 구독을 받고 있지 않습니다.")
    ).not.toBeInTheDocument();
  });

  it.each([
    ["FREE", null],
    ["ENDED", "EXPIRED"],
  ])(
    "새 구매(START_PURCHASE)가 없는 %s 공간은 버튼 자리에 새 구독을 받지 않는다고 알린다",
    async (status, closedReason) => {
      serveBilling({ status, closedReason, allowedActions: [] });
      renderIn(<PlanTab workspaceId={FREE} />);
      expect(
        await screen.findByText("지금은 새 구독을 받고 있지 않습니다.")
      ).toBeInTheDocument();
      expect(startButton()).not.toBeInTheDocument();
    }
  );

  it("진행 중인 결제 때문에 구매 버튼이 빠졌으면 새 구독을 받지 않는다고 하지 않는다", async () => {
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
      screen.queryByText("지금은 새 구독을 받고 있지 않습니다.")
    ).not.toBeInTheDocument();
  });

  it("목 salesPaused — 끝난 구독에 안내만 있고 버튼·Free 한도 막대가 없다", async () => {
    billingMock.setScenario("salesPaused");
    renderIn(<PlanTab workspaceId={PAID} />);
    expect(
      await screen.findByText("구독의 이용 기간이 끝났습니다.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("지금은 새 구독을 받고 있지 않습니다.")
    ).toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByLabelText("사용량을 불러오는 중")).toBeNull()
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("이번 달 녹음")).not.toBeInTheDocument();
    // 사용량 칸은 틀째 없다 — 빈 칸이 남지 않는다.
    expect(
      screen.getByText("현재 요금제").closest(".grid")?.children
    ).toHaveLength(1);
  });

  it("목 expired — 기간이 끝나 Free 로 돌아온 공간은 Free 사용량을 그린다", async () => {
    billingMock.setScenario("expired");
    renderIn(<PlanTab workspaceId={PAID} />);
    expect(
      await screen.findByText("구독의 이용 기간이 끝났습니다.")
    ).toBeInTheDocument();
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("이번 달 녹음")).toBeInTheDocument();
  });

  it("목 payerLeft — 자동 결제가 멈춘 것과 언제까지 Pro 인지 알리고 ADMIN 에게 결제 관리로 가는 길을 준다", async () => {
    billingMock.setScenario("payerLeft");
    const onOpenPayment = vi.fn();
    renderIn(
      <WorkspacePlanSettings workspaceId={PAID} onOpenPayment={onOpenPayment} />
    );
    expect(
      await screen.findByText(
        "등록된 카드가 없어 자동 결제가 멈췄습니다. 2026년 12월 11일까지는 Pro를 그대로 씁니다. 카드를 등록하면 구독을 이어 갈 수 있습니다."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("종료 예정")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "결제 관리에서 카드 등록" })
    );
    expect(onOpenPayment).toHaveBeenCalledOnce();
  });

  it("결제자가 빠진 구독을 멤버가 보면 관리자에게 카드 등록을 요청하라고 하고 결제 관리 버튼이 없다", async () => {
    asMember();
    const period = {
      start: "2026-11-11T09:00:00+09:00",
      end: "2026-12-11T09:00:00+09:00",
    };
    serveBilling({
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
      entitlement: {
        kind: "PAID",
        period,
        recordingAllowanceMinutes: null,
        planCode: "PRO",
      },
      currentPeriod: period,
      allowedActions: [],
      detail: { ...detail("SUCCEEDED"), methodId: null },
    });
    renderIn(<PlanTab workspaceId={FREE} />);
    expect(
      await screen.findByText(
        "등록된 카드가 없어 자동 결제가 멈췄습니다. 2026년 12월 11일까지는 Pro를 그대로 씁니다. 구독을 이어 가려면 관리자에게 카드 등록을 요청해 주세요."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /결제 관리/ })
    ).not.toBeInTheDocument();
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
    expect(goToCardEntry).not.toHaveBeenCalled();

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

const agree = () => screen.getAllByRole("checkbox")[0];
const agreePg = () =>
  screen.getByRole("checkbox", {
    name: "결제 대행 서비스 이용약관에 동의합니다.",
  });
const submit = () => screen.getByRole("button", { name: "카드 정보 입력" });
const pay = () => screen.getByRole("button", { name: "결제하기" });
/** Luhn 이 맞는 시험 카드 번호. */
const CARD_NUMBER = "4111111111111111";
const typeInto = (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
const fillCard = (number = CARD_NUMBER) => {
  typeInto("카드 번호", number);
  typeInto("유효기간", "12/39");
  typeInto("비밀번호 앞 2자리", "12");
  typeInto("생년월일 6자리", "900101");
};
/** 주문서의 두 동의를 채운다. 카드 칸은 주문서에 없다(카드 입력 화면). */
const fillAll = () => {
  fireEvent.click(agree());
  fireEvent.click(agreePg());
};
/** 카드를 기다리는 등록(S1)의 카드 입력 화면. */
const serveAwaitingSetup = (extra: Record<string, unknown> = {}) =>
  serveSetup(
    setupBody("CARD_AUTH_REQUIRED", "WAITING", {
      setupStatus: "CREATED",
      allowedActions: ["CONTINUE_SETUP", "CANCEL_SETUP"],
      ...extra,
    })
  );
const renderCardEntry = async () => {
  renderIn(<BillingCardEntryPage setupId="S1" />);
  await screen.findByLabelText("카드 번호");
};

describe("주문서", () => {
  it("공간·상품·금액·제공량·안내를 서버 값으로 그리고 동의 전에는 구매할 수 없다", async () => {
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    await screen.findByText("테스트 유저의 워크스페이스");
    expect(screen.getByText("Pro 월 구독")).toBeInTheDocument();
    // 상품 금액과 오늘 결제 금액 두 자리 모두 서버 값이다.
    expect(screen.getAllByText("24,900원")).toHaveLength(2);
    expect(screen.getByText("녹음 무제한")).toBeInTheDocument();
    expect(
      screen.getByText("이 워크스페이스의 모든 멤버가 함께 씁니다.")
    ).toBeInTheDocument();
    expect(submit()).toBeDisabled();
    fireEvent.click(agree());
    // 대행 약관 동의까지 있어야 켜진다. 카드 칸은 주문서에 없다(APP-1600).
    expect(submit()).toBeDisabled();
    fireEvent.click(agreePg());
    expect(submit()).toBeEnabled();
    expect(screen.queryByLabelText("카드 번호")).not.toBeInTheDocument();
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
    // 다음 결제 예정일·말일 규칙·해지 방법을 결제 전에 알린다.
    expect(
      screen.getByText("다음 결제 예정일").nextElementSibling
    ).toHaveTextContent(/^\d{4}년 \d{1,2}월 \d{1,2}일$/);
    expect(
      screen.getByText(/그 날짜가 없는 달은 말일에 결제됩니다/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("해지는 설정 > 결제 관리에서 관리자가 할 수 있습니다.")
    ).toBeInTheDocument();
    // 혜택은 체크 목록, 결제 조건은 「결제 안내」 아래 점 목록이다(APP-1596).
    const [benefits, terms] = screen.getAllByRole("list");
    expect(within(benefits).getAllByRole("listitem")).toHaveLength(2);
    expect(benefits).toHaveTextContent("이 워크스페이스의 모든 멤버가 함께 씁니다.");
    expect(terms.previousElementSibling).toHaveTextContent("결제 안내");
    expect(within(terms).getAllByRole("listitem")).toHaveLength(3);
    expect(terms).toHaveTextContent("해지는 설정 > 결제 관리에서");
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
      "결제일부터 7일 이내에 요청하고, 그 결제 기간에 워크스페이스 전체의 녹음 시간 합계가 20시간 이하이면 전액 환불받을 수 있습니다."
    );
    // 바로 다음 형제가 자동 결제 동의 체크다.
    expect(notice.nextElementSibling).toContainElement(agree());
  });

  it.each([
    ["SIMULATED_NO_CHARGE", "시험 결제이며 실제로 청구되지 않습니다."],
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

  it("동의하고 「카드 정보 입력」을 누르면 등록을 열고 카드 입력 화면으로 문서를 옮기며 카드는 아직 내지 않는다", async () => {
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    await screen.findByText("오늘 결제");
    fillAll();
    fireEvent.click(submit());
    await waitFor(() => expect(goToCardEntry).toHaveBeenCalled());
    const setupId = vi.mocked(goToCardEntry).mock.calls[0][0];
    expect(requests).toContain(`POST /v1/workspaces/${FREE}/billing/setups`);
    expect(requests.some((r) => r.endsWith("/card"))).toBe(false);
    expect(setupId).toEqual(expect.any(String));
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
    fillAll();
    fireEvent.click(submit());
    await waitFor(() => expect(keys).toHaveLength(1));
    await waitFor(() => expect(submit()).toBeEnabled());
    fireEvent.click(submit());
    await waitFor(() => expect(goToCardEntry).toHaveBeenCalled());
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
    fillAll();
    fireEvent.click(submit());
    expect(
      await screen.findByText(/상품 또는 상태가 바뀌었습니다/)
    ).toBeInTheDocument();
    expect(agree()).toHaveAttribute("aria-checked", "false");
    expect(submit()).toBeDisabled();
    fireEvent.click(agree());
    fireEvent.click(submit());
    await waitFor(() => expect(goToCardEntry).toHaveBeenCalled());
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("카드를 기다리는 내 등록(CONTINUE_SETUP)이 있으면 새로 열지 않고 그 등록의 카드 입력 화면으로 간다", async () => {
    serveBilling({
      mySetupId: "S9",
      allowedActions: ["CONTINUE_SETUP", "CANCEL_SETUP"],
    });
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    await screen.findByText("오늘 결제");
    expect(
      screen.queryByText("진행 중인 카드 등록이 있습니다")
    ).not.toBeInTheDocument();
    fillAll();
    fireEvent.click(submit());
    await waitFor(() => expect(goToCardEntry).toHaveBeenCalledWith("S9"));
    expect(
      requests.filter((r) => r === `POST /v1/workspaces/${FREE}/billing/setups`)
    ).toHaveLength(0);
  });

  it("요금제의 「진행 중인 카드 등록 이어가기」는 주문서를 거치지 않고 카드 입력 화면으로 간다", async () => {
    serveBilling({
      mySetupId: "S9",
      allowedActions: ["CONTINUE_SETUP", "CANCEL_SETUP"],
    });
    renderIn(<PlanTab workspaceId={FREE} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "진행 중인 카드 등록 이어가기" })
    );
    expect(goToCardEntry).toHaveBeenCalledWith("S9");
  });

  it("서버가 처리 중인 등록이 있으면 진행 상황을 보거나 취소하고 다시 시작할 수 있다", async () => {
    let open = true;
    server.use(
      http.get(`*/v1/workspaces/${FREE}/billing`, () =>
        envelope(
          billingBody(
            open
              ? { mySetupId: "S9", allowedActions: ["REFRESH_STATUS"] }
              : {}
          )
        )
      ),
      http.post(`*/v1/workspaces/${FREE}/billing/setups/S9/cancel`, () => {
        open = false;
        return envelope(setupBody("CLOSED", "CANCELED", { setupId: "S9" }));
      })
    );
    renderIn(
      <BillingCheckout workspaceId={FREE} purpose="PURCHASE" onBack={vi.fn()} />
    );
    expect(
      await screen.findByText("진행 중인 카드 등록이 있습니다")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "진행 상황 보기" })
    ).toHaveAttribute("href", "/billing/setups/S9");
    fillAll();
    expect(submit()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "취소하고 다시 시작" }));
    await waitFor(() =>
      expect(
        screen.queryByText("진행 중인 카드 등록이 있습니다")
      ).not.toBeInTheDocument()
    );
    expect(requests.filter((r) => r.endsWith("/cancel"))).toHaveLength(1);
    expect(submit()).toBeEnabled();
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
      screen.queryByRole("button", { name: "동의하고 결제하기" })
    ).not.toBeInTheDocument();
  });
});

// ---- 카드 입력 화면 ----

describe("카드 입력 화면", () => {
  /** 카드 제출을 받아 본문을 남긴다. 응답은 서버가 카드를 받은 뒤의 등록 상태다. */
  const serveCardSubmit = (
    respond: () => Response = () =>
      envelope(setupBody("BILLING_KEY", "PROCESSING"))
  ) => {
    const bodies: unknown[] = [];
    server.use(
      http.post(
        `*/v1/workspaces/${FREE}/billing/setups/S1/card`,
        async ({ request }) => {
          bodies.push(await request.clone().json());
          return respond();
        }
      )
    );
    return bodies;
  };

  it("카드를 기다리는 등록이면 금액·공간 한 줄 요약과 카드 칸만 두고, 동의는 다시 받지 않는다", async () => {
    serveAwaitingSetup();
    await renderCardEntry();
    expect(
      await screen.findByText("테스트 유저의 워크스페이스 · Pro 월 24,900원")
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(pay()).toBeDisabled();
    fillCard();
    expect(pay()).toBeEnabled();
    expect(
      screen.getByText(
        "카드 정보는 암호화해 결제 대행사에 전달하며, HeyMoa 는 카드 번호를 저장하지 않습니다."
      )
    ).toBeInTheDocument();
    // 돌아가기는 일반 링크라 문서를 새로 연다(분석이 실린 설정 창 문서로 카드 정보를 데려가지 않는다).
    expect(screen.getByRole("link", { name: "돌아가기" })).toHaveAttribute(
      "href",
      `/w/${FREE}?settings=billing`
    );
  });

  it("카드 칸과 그 묶음에 PostHog 기록 제외 표시가 있다", async () => {
    serveAwaitingSetup();
    await renderCardEntry();
    for (const label of [
      "카드 번호",
      "유효기간",
      "비밀번호 앞 2자리",
      "생년월일 6자리",
    ])
      expect(screen.getByLabelText(label)).toHaveClass("ph-no-capture");
    expect(
      screen.getByRole("region", { name: "카드 정보" })
    ).toHaveClass("ph-no-capture");
  });

  it("카드 변경 등록이면 「카드 등록하기」이고 결제 관리로 돌아간다", async () => {
    serveAwaitingSetup({ purpose: "REPLACE" });
    await renderCardEntry();
    expect(
      await screen.findByText(
        "테스트 유저의 워크스페이스 · 카드만 등록하고 지금 결제하지 않습니다"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "카드 등록하기" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "돌아가기" })).toHaveAttribute(
      "href",
      `/w/${FREE}?settings=payment`
    );
  });

  it("카드를 내면 결과 화면으로 간다", async () => {
    serveAwaitingSetup();
    const bodies = serveCardSubmit();
    await renderCardEntry();
    fillCard();
    fireEvent.click(pay());
    await waitFor(() => expect(goToSetupResult).toHaveBeenCalledWith("S1"));
    expect(bodies).toEqual([
      {
        cardNumber: CARD_NUMBER,
        expiryMonth: "12",
        expiryYear: "39",
        identity: "900101",
        passwordPrefix: "12",
      },
    ]);
  });

  it("카드 정보는 이벤트·주소·저장소·콘솔 어디에도 남지 않고 제출 뒤 칸이 비워진다", async () => {
    const log = vi.spyOn(console, "log");
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    serveAwaitingSetup();
    serveCardSubmit();
    await renderCardEntry();
    fillCard();
    fireEvent.click(pay());
    await waitFor(() => expect(goToSetupResult).toHaveBeenCalled());
    const leaked = (text: string) =>
      text.includes(CARD_NUMBER) || text.includes("900101");
    expect(leaked(JSON.stringify(vi.mocked(track).mock.calls))).toBe(false);
    expect(
      leaked(JSON.stringify(vi.mocked(goToSetupResult).mock.calls))
    ).toBe(false);
    expect(requests.some(leaked)).toBe(false);
    expect(window.location.href).not.toMatch(/4111|900101/);
    const stored = [localStorage, sessionStorage]
      .flatMap((store) => Object.keys(store).map((k) => store.getItem(k)))
      .join("|");
    expect(leaked(stored)).toBe(false);
    for (const spy of [log, warn, error])
      expect(leaked(JSON.stringify(spy.mock.calls))).toBe(false);
    // 제출이 끝나면 칸을 비운다.
    expect(screen.getByLabelText("카드 번호")).toHaveValue("");
    expect(screen.getByLabelText("생년월일 6자리")).toHaveValue("");
    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });

  it("틀린 칸은 떠난 뒤 그 아래 한 줄로 알리고, 법인 카드는 사업자등록번호 10자리를 받는다", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-12T12:00:00+09:00"), shouldAdvanceTime: true });
    serveAwaitingSetup();
    await renderCardEntry();
    typeInto("카드 번호", "4111 1111 1111 1112");
    expect(screen.getByText("카드 번호를 확인해 주세요.")).toBeInTheDocument();
    typeInto("카드 번호", "4111-1111-1111-1111");
    expect(screen.getByLabelText("카드 번호")).toHaveValue(
      "4111 1111 1111 1111"
    );
    expect(
      screen.queryByText("카드 번호를 확인해 주세요.")
    ).not.toBeInTheDocument();
    typeInto("유효기간", "1026");
    expect(screen.getByLabelText("유효기간")).toHaveValue("10/26");
    expect(screen.getByText("유효기간이 지난 카드입니다.")).toBeInTheDocument();
    typeInto("유효기간", "1126");
    expect(
      screen.queryByText("유효기간이 지난 카드입니다.")
    ).not.toBeInTheDocument();
    typeInto("유효기간", "1326");
    expect(
      screen.getByText("유효기간을 MM/YY 로 입력해 주세요.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "법인 카드" }));
    typeInto("사업자등록번호 10자리", "12345678901234");
    expect(screen.getByLabelText("사업자등록번호 10자리")).toHaveValue(
      "1234567890"
    );
    expect(
      screen.queryByText("사업자등록번호 10자리를 확인해 주세요.")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호 앞 2자리")).toHaveAttribute(
      "type",
      "password"
    );
  });

  it("대행사가 카드 정보를 거절하면(400) 다시 확인하라고 알리고 이동하지 않으며, 다시 내면 같은 등록에 낸다", async () => {
    serveAwaitingSetup();
    let calls = 0;
    serveCardSubmit(() =>
      ++calls === 1
        ? failure("BAD_REQUEST", "잘못된 요청입니다.", 400)
        : envelope(setupBody("BILLING_KEY", "PROCESSING"))
    );
    await renderCardEntry();
    fillCard();
    fireEvent.click(pay());
    expect(
      await screen.findByText("카드 정보를 다시 확인해 주세요.")
    ).toBeInTheDocument();
    expect(goToSetupResult).not.toHaveBeenCalled();
    fireEvent.click(pay());
    await waitFor(() => expect(goToSetupResult).toHaveBeenCalledWith("S1"));
    expect(
      requests.filter((r) => r === `POST /v1/workspaces/${FREE}/billing/setups`)
    ).toHaveLength(0);
  });

  it("시도 제한(429)이면 서버 문구를 그 자리에 알리고 이동하지 않는다", async () => {
    serveAwaitingSetup();
    serveCardSubmit(() =>
      failure("BILLING_CARD_RATE_LIMITED", "서버가 정한 시도 제한 문구", 429)
    );
    await renderCardEntry();
    fillCard();
    fireEvent.click(pay());
    expect(
      await screen.findByText("서버가 정한 시도 제한 문구")
    ).toBeInTheDocument();
    expect(goToSetupResult).not.toHaveBeenCalled();
    expect(pay()).toBeEnabled();
  });

  it("봉투 없는 429 는 카드 등록 시도 문구로 알린다", async () => {
    serveAwaitingSetup();
    serveCardSubmit(() => new HttpResponse(null, { status: 429 }));
    await renderCardEntry();
    fillCard();
    fireEvent.click(pay());
    expect(
      await screen.findByText(
        "카드 등록 시도가 너무 많습니다. 잠시 뒤 다시 시도해 주세요."
      )
    ).toBeInTheDocument();
  });

  it("목의 cardRateLimited 시나리오는 429 다", async () => {
    billingMock.setScenario("cardRateLimited");
    const response = await fetch(
      `http://localhost/v1/workspaces/${FREE}/billing/setups/S1/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }
    );
    expect(response.status).toBe(429);
    billingMock.setScenario("ok");
  });

  it("등록이 더는 카드를 받지 않으면(409) 결과 화면으로 간다", async () => {
    serveAwaitingSetup();
    serveCardSubmit(() =>
      failure("BILLING_IN_PROGRESS", "팀의 구독 처리가 진행 중입니다.", 409)
    );
    await renderCardEntry();
    fillCard();
    fireEvent.click(pay());
    await waitFor(() => expect(goToSetupResult).toHaveBeenCalledWith("S1"));
  });

  it("카드를 기다리지 않는 등록으로 직접 들어오면 카드 칸 없이 결과 화면으로 바꿔 간다", async () => {
    serveSetup(setupBody("BILLING_KEY", "PROCESSING"));
    renderIn(<BillingCardEntryPage setupId="S1" />);
    await waitFor(() =>
      expect(replaceWithSetupResult).toHaveBeenCalledWith("S1")
    );
    expect(screen.queryByLabelText("카드 번호")).not.toBeInTheDocument();
  });

  it("없는 등록이면 찾을 수 없다고 알린다", async () => {
    server.use(
      http.get("*/v1/me/billing/setups/S1", () =>
        failure("BILLING_SETUP_NOT_FOUND", "없음", 404)
      )
    );
    renderIn(<BillingCardEntryPage setupId="S1" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByLabelText("카드 번호")).not.toBeInTheDocument();
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
    ["닫힘(만료)", setupBody("CLOSED", "EXPIRED"), "카드 등록이 종료되었습니다"],
    [
      "발급 결과 불명",
      setupBody("BILLING_KEY", "UNKNOWN", { setupStatus: "ISSUE_UNKNOWN" }),
      "카드 등록 결과를 확인하지 못했습니다",
    ],
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

  it("첫 구매의 결과 화면 제목은 「결제 결과」, 카드 변경은 「카드 등록 결과」다", async () => {
    serveSetup(setupBody("PAYMENT", "PROCESSING"));
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByRole("heading", { name: "결제 결과" })
    ).toBeInTheDocument();
    cleanup();
    serveSetup(setupBody("BILLING_KEY", "PROCESSING", { purpose: "REPLACE" }));
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByRole("heading", { name: "카드 등록 결과" })
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
      screen.queryByText("카드 등록이 종료되었습니다")
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

  it("완료는 워크스페이스·금액·기간·다음 결제일을 그린다", async () => {
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
    expect(screen.getByText("24,900원")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(
      screen.getByText("2026년 11월 11일부터 2026년 12월 11일 전까지")
    ).toBeInTheDocument();
    expect(screen.getByText("2026년 12월 11일")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "워크스페이스로 가기" })).toHaveAttribute(
      "href",
      `/w/${FREE}`
    );
  });

  it("확정 거절은 같은 카드로 다시 결제하지 않고 카드 등록부터 새로 시작하게 한다", async () => {
    serveSetup(
      setupBody("PAYMENT", "DECLINED", {
        allowedActions: ["START_PURCHASE"],
        latestAttempt: { attemptId: "A1", status: "FAILED", errorCode: "CARD_DECLINED" },
      })
    );
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(
      await screen.findByText("결제가 승인되지 않았습니다")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "카드사에서 결제를 거절했습니다. 카드 상태를 확인하거나 다른 카드로 다시 시도해 주세요."
      )
    ).toBeInTheDocument();
    // 내부 코드는 사유 문장이 아니라 문의용 보조 줄로만 남는다.
    expect(
      screen.getByText("문의할 때 이 코드를 알려 주세요: CARD_DECLINED")
    ).toBeInTheDocument();
    expect(screen.queryByText(/사유 코드/)).not.toBeInTheDocument();
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

/** 목에 등록을 열고 카드를 낸다(화면 밖). 등록 번호를 돌려준다. */
async function openAndSubmitCard() {
  const post = (path: string, body: unknown) =>
    fetch(`http://localhost/v1/workspaces/${FREE}/billing/setups${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const created = await post("", {
    requestKey: "k",
    purpose: "PURCHASE",
    expectedProductVersion: "TEST_MONTHLY_V1",
    agreementVersion: "BILLING_TEST_V1",
  });
  const { setupId } = (await created.json()).data as { setupId: string };
  await post(`/${setupId}/card`, {
    cardNumber: CARD_NUMBER,
    expiryMonth: "12",
    expiryYear: "39",
    identity: "900101",
    passwordPrefix: "12",
  });
  return setupId;
}

describe("등록 결과 — 완료 맡기기·다시 읽기·이벤트·캐시", () => {
  it("카드를 낸 등록은 목 흐름을 따라 완료된다", async () => {
    billingMock.setScenario("ok");
    const setupId = await openAndSubmitCard();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderIn(<BillingSetupResultPage setupId={setupId} />);
    for (let i = 0; i < 5; i += 1)
      await act(() => vi.advanceTimersByTimeAsync(2100));
    expect(
      await screen.findByText("결제가 완료되었습니다")
    ).toBeInTheDocument();
    expect(resultEvents()).toEqual([
      { workspace_id: FREE, provider: "FAKE", result: "completed" },
    ]);
  });

  it("목 issueUnknown — 발급 결과 불명이면 결제가 없었다고 알리고 새로 시작하게 한다", async () => {
    billingMock.setScenario("issueUnknown");
    const setupId = await openAndSubmitCard();
    renderIn(<BillingSetupResultPage setupId={setupId} />);
    expect(
      await screen.findByText("카드 등록 결과를 확인하지 못했습니다")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "결제는 이루어지지 않았습니다. 카드 등록부터 다시 시작해 주세요."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새로 시작" })).toHaveAttribute(
      "href",
      `/w/${FREE}?settings=billing`
    );
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
      { workspace_id: FREE, provider: "NICEPAY", result: "unknown" },
      { workspace_id: FREE, provider: "NICEPAY", result: "completed" },
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
