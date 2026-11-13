/**
 * 설정 › 결제 관리(결제 수단·구독·결제 내역)와 그 안의 카드 변경·결제 상세 시험(APP-1565, PRO-75). **MSW 목으로 그린 것이라 서버·PG 정합성의 증거가 아니다.**
 * 기본은 목의 실제 흐름(유료 공간 「제품 팀」)을 밟고, 서버만 낼 수 있는 응답(403·특정 409)은 그 요청만 바꿔 끼운다.
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

import { CardChangeFrame } from "@/components/billing/card-change-frame";
import { BillingPaymentDetail } from "@/components/billing/billing-payment-detail";
import { MyPaymentsSettings } from "@/components/billing/my-payments-settings";
import { BillingSetupResultPage } from "@/components/billing/billing-setup-result-page";
import { WorkspacePaymentSettings } from "@/components/billing/payment-settings";
import { track } from "@/lib/analytics/track";
import { goToSetupResult } from "@/lib/billing/navigate";
import { billingHandlers, billingMock } from "@/lib/mocks/billing";
import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";

vi.mock("@/lib/billing/navigate", () => ({
  goToSetupResult: vi.fn(),
}));
vi.mock("@/lib/analytics/track", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/track")>()),
  track: vi.fn(),
}));

const PAID = "01K0000000006";
const CURRENT_PAYMENT = "0P00000000003";
const OLD_PAYMENT = "0P00000000002";

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
  billingMock.setScenario(null);
  vi.mocked(track).mockClear();
  vi.mocked(goToSetupResult).mockClear();
  requests.length = 0;
});
afterAll(() => server.close());

function renderIn(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const failure = (code: string, message: string, status: number) =>
  HttpResponse.json(
    { success: false, data: null, error: { code, message, details: null } },
    { status }
  );
const posted = (path: string) =>
  requests.filter((request) => request === `POST ${path}`).length;
const events = (name: string) =>
  vi
    .mocked(track)
    .mock.calls.filter(([event]) => event === name)
    .map(([, props]) => props);

/** 설정 › 결제 관리 탭. 돌려주는 것은 「구독」 영역이다. */
async function openPaid(workspaceId = PAID) {
  renderIn(
    <WorkspacePaymentSettings workspaceId={workspaceId} onOpenPlans={vi.fn()} />
  );
  return screen.findByRole("region", { name: "구독" });
}
const methodArea = () => screen.getByRole("region", { name: "결제 수단" });
const paymentDetail = (paymentId: string) => (
  <BillingPaymentDetail
    workspaceId={PAID}
    paymentId={paymentId}
    onBack={vi.fn()}
  />
);

describe("결제 수단·구독", () => {
  it("다음 결제의 날짜·금액과 카드·최근 결제를 그리고, 환불 버튼은 없다", async () => {
    const area = await openPaid();
    expect(
      within(area).getByText("2026년 12월 11일 · 24,900원")
    ).toBeInTheDocument();
    expect(
      within(methodArea()).getByText("헤이모아카드 신용")
    ).toBeInTheDocument();
    expect(
      within(methodArea()).getByText("4579-****-****-1234")
    ).toBeInTheDocument();
    expect(
      await within(area).findByRole("button", { name: /결제 상세/ })
    ).toBeInTheDocument();
    expect(
      within(area).queryByRole("button", { name: "환불 요청" })
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(events("billing_payment_history_viewed")).toEqual([
        { scope: "workspace" },
      ])
    );
  });

  it("카드 없이 종료 예정이면 「카드 등록」과 멈춤 안내를 보이고 재개 버튼은 없다(APP-1588)", async () => {
    billingMock.setScenario("payerLeft");
    const area = await openPaid();
    expect(
      await within(area).findByText(
        "등록된 결제 수단이 없어 자동 결제가 멈췄습니다. 2026년 12월 11일까지 쓸 수 있고, 카드를 등록한 뒤 재개하면 구독이 이어집니다."
      )
    ).toBeInTheDocument();
    expect(
      within(methodArea()).getByRole("button", { name: "카드 등록" })
    ).toBeInTheDocument();
    expect(
      within(methodArea()).queryByRole("button", { name: "변경" })
    ).not.toBeInTheDocument();
    expect(
      within(area).queryByRole("button", { name: "구독 재개" })
    ).not.toBeInTheDocument();
  });

  it("다른 관리자가 등록한 카드면 카드 번호 아래에 그렇게 적고, 내 카드면 적지 않는다", async () => {
    await openPaid();
    expect(
      within(methodArea()).queryByText("다른 관리자가 등록한 카드입니다")
    ).not.toBeInTheDocument();
    cleanup();
    billingMock.setScenario("otherPayer");
    await openPaid();
    expect(
      await within(methodArea()).findByText("다른 관리자가 등록한 카드입니다")
    ).toBeInTheDocument();
  });

  it("최근 결제를 누르면 같은 탭에서 결제 상세로 들어가고 「결제 관리」로 돌아온다", async () => {
    const area = await openPaid();
    fireEvent.click(
      await within(area).findByRole("button", { name: /결제 상세/ })
    );
    expect(
      await screen.findByRole("heading", { name: "결제 상세" })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "문의·피드백" })
    ).toBeInTheDocument();
    expect(
      requests.some((r) => r.endsWith(`/billing/payments/${CURRENT_PAYMENT}`))
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "결제 관리" }));
    expect(
      await screen.findByRole("region", { name: "구독" })
    ).toBeInTheDocument();
  });

  it("「변경」을 누르면 바로 카드 변경 모달이 열리고, 닫으면 결제 관리 그대로다(APP-1600)", async () => {
    await openPaid();
    fireEvent.click(within(methodArea()).getByRole("button", { name: "변경" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "카드 변경" })
    ).toBeInTheDocument();
    expect(within(dialog).getByTitle("카드 변경")).toHaveAttribute(
      "src",
      `/billing/card-change/${PAID}`
    );
    // 부모 문서에는 카드 칸도 동의도 없다.
    expect(screen.queryByLabelText("카드 번호")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(events("billing_card_change_started")).toEqual([
      { workspace_id: PAID },
    ]);
    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(methodArea()).toBeInTheDocument();
  });

  it("카드가 없으면 「카드 등록」이 「카드 등록」 모달을 연다", async () => {
    billingMock.setScenario("payerLeft");
    await openPaid();
    fireEvent.click(
      await within(methodArea()).findByRole("button", { name: "카드 등록" })
    );
    expect(
      await screen.findByRole("heading", { name: "카드 등록" })
    ).toBeInTheDocument();
  });

  it("해지는 확인 창을 거쳐야 호출되고, 끝나면 언제까지 쓰는지 보인다", async () => {
    const area = await openPaid();
    fireEvent.click(within(area).getByRole("button", { name: "구독 해지" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        "2026년 12월 11일 오전 12:00까지는 지금처럼 Pro를 쓸 수 있고, 그 뒤 Free로 바뀝니다."
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("다음 결제(24,900원)부터 청구되지 않습니다.")
    ).toBeInTheDocument();
    expect(events("billing_cancel_dialog_opened")).toEqual([
      { workspace_id: PAID },
    ]);
    const path = `/v1/workspaces/${PAID}/billing/subscription/cancel`;
    expect(posted(path)).toBe(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "해지" }));
    expect(
      await within(area).findByText(
        "구독을 해지했습니다. 2026년 12월 11일까지 쓸 수 있습니다."
      )
    ).toBeInTheDocument();
    expect(posted(path)).toBe(1);
    expect(events("billing_subscription_canceled")).toEqual([
      { workspace_id: PAID },
    ]);
    // 해지 예약 뒤에는 재개·카드 삭제가 열리고, 다음 결제가 없다고 적는다.
    expect(
      await within(area).findByRole("button", { name: "구독 재개" })
    ).toBeInTheDocument();
    expect(
      within(area).getByText(
        "2026년 12월 11일 오전 12:00까지 쓰고 이후 Free로 바뀝니다. 다음 결제는 청구되지 않습니다."
      )
    ).toBeInTheDocument();
    expect(
      within(methodArea()).getByRole("button", { name: "삭제" })
    ).toBeInTheDocument();

    // 다음 결제 금액(`nextChargeAmountKrw`)은 해지 예약 중에 없다 — 재개 확인 창은 금액 없이 날짜만 말하고(APP-1596),
    // 재개 뒤에는 서버가 다시 준 금액으로 안내한다.
    fireEvent.click(within(area).getByRole("button", { name: "구독 재개" }));
    const resume = await screen.findByRole("alertdialog");
    expect(
      within(resume).getByText(
        "2026년 12월 11일부터 이 카드로 결제되고 매월 자동으로 갱신됩니다."
      )
    ).toBeInTheDocument();
    fireEvent.click(within(resume).getByRole("button", { name: "재개" }));
    expect(
      await within(area).findByText(
        "구독을 재개했습니다. 2026년 12월 11일에 24,900원이 결제됩니다."
      )
    ).toBeInTheDocument();
  });

  it("갱신 결과를 기다리는 동안에도 해지를 예약하고, 지난 기간 끝 날짜 대신 결과에 따라 끝난다고 적는다", async () => {
    billingMock.setScenario("renewalChecking");
    const area = await openPaid();
    // 예약 전에는 「{end}까지 계속 쓸 수 있다」는 힌트를 두지 않는다.
    expect(
      within(area).queryByText(/까지는 계속 쓸 수 있습니다/)
    ).not.toBeInTheDocument();
    // 「다음 결제」는 지금 확인 중인 그 결제다 — 이미 지난 기간 끝을 다음 결제일로 보이지 않는다.
    expect(within(area).getByText("결제 결과 확인 중")).toBeInTheDocument();
    expect(within(area).queryByText(/12월 11일 · /)).not.toBeInTheDocument();
    fireEvent.click(
      await within(area).findByRole("button", { name: "구독 해지" })
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        "지금 확인 중인 결제가 승인되면 그 이용 기간이 끝날 때까지 Pro를 쓰고, 다음 결제부터 청구되지 않습니다. 승인되지 않으면 구독은 바로 종료됩니다."
      )
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/12월 11일/)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "해지" }));
    expect(
      await within(area).findByText(
        "해지를 예약했습니다. 확인 중인 결제 결과에 따라 종료 시점이 정해집니다."
      )
    ).toBeInTheDocument();
    expect(posted(`/v1/workspaces/${PAID}/billing/subscription/cancel`)).toBe(
      1
    );
    expect(within(area).queryByText(/12월 11일까지/)).not.toBeInTheDocument();
    expect(
      within(area).queryByRole("button", { name: "구독 해지" })
    ).not.toBeInTheDocument();
    expect(
      within(area).queryByRole("button", { name: "구독 재개" })
    ).not.toBeInTheDocument();
  });

  it("재개는 지금 결제되지 않는다고 적고, 관리자가 아니어서 403 이면 그 이유를 안내한다", async () => {
    const area = await openPaid();
    fireEvent.click(within(area).getByRole("button", { name: "구독 해지" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "해지",
      })
    );
    fireEvent.click(
      await within(area).findByRole("button", { name: "구독 재개" })
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("지금 결제되지 않습니다.")
    ).toBeInTheDocument();
    server.use(
      http.post(`*/v1/workspaces/${PAID}/billing/subscription/resume`, () =>
        failure("WORKSPACE_ACCESS_DENIED", "권한이 없습니다.", 403)
      )
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "재개" }));
    expect(
      await within(area).findByText("관리자만 할 수 있습니다.")
    ).toBeInTheDocument();
    expect(events("billing_subscription_resumed")).toEqual([
      { workspace_id: PAID, result: "not_admin" },
    ]);
  });

  it("서버가 행동을 주지 않으면 관리 버튼이 하나도 없다", async () => {
    server.use(
      http.get(`*/v1/workspaces/${PAID}/billing`, () =>
        HttpResponse.json({
          success: true,
          error: null,
          data: {
            workspaceId: PAID,
            enforced: true,
            status: "ACTIVE",
            product: {
              agreementVersion: "A",
              policyVersion: "P",
              amountKrw: 24900,
              recordingAllowanceMinutes: null,
              freeRecordingAllowanceMinutes: 1800,
              currency: "KRW",
              billingInterval: "MONTH",
              planCode: "PRO",
              testPaymentNotice: null,
            },
            entitlement: {
              kind: "PAID",
              planCode: "PRO",
              recordingAllowanceMinutes: null,
              period: {
                start: "2026-11-11T00:00:00+09:00",
                end: "2026-12-11T00:00:00+09:00",
              },
            },
            currentPeriod: {
              start: "2026-11-11T00:00:00+09:00",
              end: "2026-12-11T00:00:00+09:00",
            },
            cancelAtPeriodEnd: false,
            mySetupId: null,
            teamSetupInProgress: false,
            latestAttemptStatus: null,
            allowedActions: [],
            detail: {
              methodVersion: 1,
              maskedCard: null,
              latestAttempt: null,
              refundedAttempt: null,
              subscriptionVersion: 1,
              openCycleId: null,
              methodPayerIsMe: true,
              currentPaymentId: null,
              methodId: "M1",
            },
          },
        })
      )
    );
    const area = await openPaid();
    expect(within(area).queryAllByRole("button")).toEqual([]);
    expect(within(methodArea()).queryAllByRole("button")).toEqual([]);
  });

  it("결제 상태가 바뀌었으면(409) 다시 읽고 다시 확인하라고 한다", async () => {
    const area = await openPaid();
    fireEvent.click(within(area).getByRole("button", { name: "구독 해지" }));
    server.use(
      http.post(`*/v1/workspaces/${PAID}/billing/subscription/cancel`, () =>
        failure("BILLING_STATE_CHANGED", "결제 정보가 바뀌었습니다.", 409)
      )
    );
    const before = requests.filter(
      (r) => r === `GET /v1/workspaces/${PAID}/billing`
    ).length;
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "해지",
      })
    );
    expect(
      await within(area).findByText(/최신 내용을 불러왔으니 다시 확인해 주세요/)
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        requests.filter((r) => r === `GET /v1/workspaces/${PAID}/billing`)
          .length
      ).toBeGreaterThan(before)
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("해지가 403(관리자 아님)이면 확인 창을 닫고 그 자리에 안내한다", async () => {
    server.use(
      http.post(`*/v1/workspaces/${PAID}/billing/subscription/cancel`, () =>
        failure("WORKSPACE_ACCESS_DENIED", "권한이 없습니다.", 403)
      )
    );
    const area = await openPaid();
    fireEvent.click(within(area).getByRole("button", { name: "구독 해지" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "해지",
      })
    );
    expect(
      await within(area).findByText("관리자만 할 수 있습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(events("billing_subscription_canceled")).toEqual([]);
  });

  it("카드 삭제가 403(관리자 아님)이면 확인 창을 닫고 안내한다", async () => {
    server.use(
      http.delete(`*/v1/workspaces/${PAID}/billing/payment-methods/*`, () =>
        failure("WORKSPACE_ACCESS_DENIED", "권한이 없습니다.", 403)
      )
    );
    const area = await openPaid();
    const method = methodArea();
    fireEvent.click(within(area).getByRole("button", { name: "구독 해지" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "해지",
      })
    );
    fireEvent.click(
      await within(method).findByRole("button", { name: "삭제" })
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "삭제",
      })
    );
    expect(
      await within(area).findByText("관리자만 할 수 있습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("지우려던 카드가 이미 없으면(404) 확인 창을 닫고 다시 읽으라고 한다", async () => {
    // 실제 서버는 이 공간의 수단이 아니거나 없으면 404 를 준다 — 다른 관리자가 먼저 바꾼 낡은 화면에서 난다.
    server.use(
      http.delete(`*/v1/workspaces/${PAID}/billing/payment-methods/*`, () =>
        failure(
          "BILLING_PAYMENT_METHOD_NOT_FOUND",
          "결제 수단을 찾을 수 없습니다.",
          404
        )
      )
    );
    const area = await openPaid();
    const method = methodArea();
    fireEvent.click(within(area).getByRole("button", { name: "구독 해지" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "해지",
      })
    );
    fireEvent.click(
      await within(method).findByRole("button", { name: "삭제" })
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "삭제",
      })
    );
    expect(
      await within(area).findByText(
        "결제 상태가 바뀌었습니다. 최신 내용을 불러왔으니 다시 확인해 주세요."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("살아 있는 구독의 카드 삭제(409)는 카드 변경을 안내한다", async () => {
    billingMock.setScenario("methodInUse");
    const area = await openPaid();
    // 확인 창이 열린 동안 나머지는 접근성 트리에서 숨는다 — 영역은 창을 열기 전에 잡아 둔다.
    const method = methodArea();
    fireEvent.click(within(area).getByRole("button", { name: "구독 해지" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "해지",
      })
    );
    fireEvent.click(
      await within(method).findByRole("button", { name: "삭제" })
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        "자동 결제에 쓰는 카드 정보만 삭제합니다. 결제 내역은 남습니다."
      )
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(
      await within(area).findByText(/변경 버튼을 눌러 주세요/)
    ).toBeInTheDocument();
    expect(events("billing_payment_method_deleted")).toEqual([
      { workspace_id: PAID, result: "in_use" },
    ]);
  });
});

/** 끝난 카드 변경(REPLACE) 등록의 상태 조회. */
const replacedSetup = () =>
  http.get("*/v1/me/billing/setups/S1", () =>
    HttpResponse.json({
      success: true,
      error: null,
      data: {
        setupId: "S1",
        workspaceId: PAID,
        purpose: "REPLACE",
        statusUrl: "/v1/me/billing/setups/S1",
        setupStatus: "ISSUED",
        stage: "COMPLETED",
        status: "COMPLETED",
        failureCode: null,
        allowedActions: [],
        amountKrw: 24900,
        paidPeriod: null,
        latestAttempt: null,
        originAttempt: null,
        testPaymentNotice: null,
        planCode: "PRO",
        provider: "NICEPAY",
        pollAfterSeconds: null,
      },
    })
  );

describe("카드 변경", () => {
  it("카드 변경 문서는 지금 결제되지 않는다고 적고, 카드와 두 동의를 받아 REPLACE 로 등록을 열어 카드를 낸다", async () => {
    renderIn(<CardChangeFrame workspaceId={PAID} />);
    expect(
      await screen.findByText("카드만 바뀌고 지금 결제되지 않습니다.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("새 카드 등록에 실패하면 지금 카드가 그대로 유지됩니다.")
    ).toBeInTheDocument();
    // 내가 이미 결제자면 결제자가 바뀐다는 안내가 없다.
    expect(screen.queryByText(/내 카드로 청구되고/)).not.toBeInTheDocument();
    let body: Record<string, unknown> | null = null;
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/billing/setups"))
        body = await request.clone().json();
    });
    const submit = screen.getByRole("button", { name: "카드 등록하기" });
    for (const checkbox of screen.getAllByRole("checkbox"))
      fireEvent.click(checkbox);
    // 카드 칸이 다 맞아야 켜진다.
    expect(submit).toBeDisabled();
    for (const [label, value] of [
      ["카드 번호", "4111111111111111"],
      ["유효기간", "12/39"],
      ["비밀번호 앞 2자리", "12"],
      ["생년월일 6자리", "900101"],
    ]) {
      const input = screen.getByLabelText(label);
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    }
    fireEvent.click(submit);
    await waitFor(() =>
      expect(requests.some((r) => r.endsWith("/card"))).toBe(true)
    );
    expect(body).toMatchObject({ purpose: "REPLACE" });
    // 분석 없는 문서라 이벤트를 내지 않는다(시작 이벤트는 모달을 연 설정 창이 낸다).
    expect(events("billing_card_change_started")).toEqual([]);
  });

  it("지금 카드가 없으면 지금 카드 줄을 숨기고 결제자가 바뀐다고 적는다", async () => {
    billingMock.setScenario("payerLeft");
    renderIn(<CardChangeFrame workspaceId={PAID} />);
    expect(
      await screen.findByText(
        "새 카드를 등록하면 다음 결제부터 내 카드로 청구되고, 결제 내역도 내 계정에 쌓입니다."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("지금 카드")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "새 카드 등록에 실패하면 지금 카드가 그대로 유지됩니다."
      )
    ).not.toBeInTheDocument();
    // 바뀔 카드가 없고 구독은 종료 예정이다 — 「카드만 바뀌고」와 「다음 결제부터 자동 결제」는 거짓이다.
    expect(screen.getByText("지금 결제되지 않습니다.")).toBeInTheDocument();
    expect(
      screen.queryByText("카드만 바뀌고 지금 결제되지 않습니다.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "구독을 재개하면 다음 결제부터 이 워크스페이스의 구독 금액(매월 24,900원)이 이 카드로 자동 결제되는 데 동의합니다."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "카드 등록하기" })
    ).toBeInTheDocument();
  });

  it("다른 관리자의 카드를 바꿀 때는 지금 카드를 두고 결제자가 바뀐다고 적는다", async () => {
    billingMock.setScenario("otherPayer");
    renderIn(<CardChangeFrame workspaceId={PAID} />);
    expect(
      await screen.findByText(/다음 결제부터 내 카드로 청구되고/)
    ).toBeInTheDocument();
    expect(screen.getByText("지금 카드")).toBeInTheDocument();
  });

  it("종료 예정인 구독에 카드를 등록한 결과는 재개해야 결제된다고 적는다", async () => {
    billingMock.setScenario("payerLeft");
    server.use(replacedSetup());
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(await screen.findByText("카드를 등록했습니다")).toBeInTheDocument();
    expect(
      screen.getByText(
        "지금 결제되지 않았습니다. 구독은 아직 종료 예정입니다. 결제 관리에서 재개하면 다음 결제부터 이 카드로 결제됩니다."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("카드를 바꿨습니다")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "결제 관리로 가기" })
    ).toBeInTheDocument();
  });

  it("결과 화면은 구매와 다른 문구로 끝나고 구매 결과 이벤트를 내지 않는다", async () => {
    server.use(replacedSetup());
    renderIn(<BillingSetupResultPage setupId="S1" />);
    expect(await screen.findByText("카드를 바꿨습니다")).toBeInTheDocument();
    expect(
      screen.getByText(
        "지금 결제되지 않았습니다. 다음 결제부터 새 카드로 결제됩니다."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("결제가 완료되었습니다")).not.toBeInTheDocument();
    expect(screen.queryByText("24,900원")).not.toBeInTheDocument();
    expect(events("billing_card_setup_resulted")).toEqual([]);
  });
});

describe("결제 상세", () => {
  it("환불은 화면에서 요청하지 않고 문의로 받으며, 문의로 처리된 환불은 당시 결과와 지금을 가른다", async () => {
    server.use(
      http.get(
        `*/v1/workspaces/${PAID}/billing/payments/${CURRENT_PAYMENT}`,
        () =>
          HttpResponse.json({
            success: true,
            error: null,
            data: {
              paymentId: CURRENT_PAYMENT,
              workspaceId: PAID,
              workspaceName: "제품 팀",
              kind: "RENEWAL",
              cycleId: "0C00000000002",
              attemptNumber: 1,
              status: "SUCCEEDED",
              completedAt: "2026-11-11T09:05:00+09:00",
              period: {
                start: "2026-11-11T00:00:00+09:00",
                end: "2026-12-11T00:00:00+09:00",
              },
              amountKrw: 24900,
              currency: "KRW",
              errorCode: null,
              maskedCard: null,
              refundStatus: "SUCCEEDED",
              refundOrigin: "OPERATOR",
              payerIsMe: true,
              cycleStatus: "REFUNDED",
            },
          })
      )
    );
    renderIn(paymentDetail(CURRENT_PAYMENT));
    expect(
      await screen.findByText("환불되어 이 기간의 이용 권한이 없습니다.")
    ).toBeInTheDocument();
    expect(screen.getByText("결제 완료")).toBeInTheDocument();
    expect(screen.getByText("환불됨 · 문의 요청")).toBeInTheDocument();
    expect(screen.getByText(/환불 요청은/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "문의·피드백" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "환불 요청" })
    ).not.toBeInTheDocument();
  });

  it("취소 처리 중이면 5초마다 다시 읽다가 2분 뒤 멈춘다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let reads = 0;
    server.use(
      http.get(
        `*/v1/workspaces/${PAID}/billing/payments/${CURRENT_PAYMENT}`,
        () => {
          reads += 1;
          return HttpResponse.json({
            success: true,
            error: null,
            data: {
              paymentId: CURRENT_PAYMENT,
              workspaceId: PAID,
              workspaceName: "제품 팀",
              kind: "RENEWAL",
              cycleId: "0C00000000002",
              attemptNumber: 1,
              status: "SUCCEEDED",
              completedAt: "2026-11-11T09:05:00+09:00",
              period: {
                start: "2026-11-11T00:00:00+09:00",
                end: "2026-12-11T00:00:00+09:00",
              },
              amountKrw: 24900,
              currency: "KRW",
              errorCode: null,
              maskedCard: null,
              refundStatus: "PROCESSING",
              refundOrigin: "OPERATOR",
              payerIsMe: true,
              cycleStatus: "OPEN",
            },
          });
        }
      )
    );
    try {
      renderIn(paymentDetail(CURRENT_PAYMENT));
      await screen.findByText("결제 취소를 처리하고 있습니다.");
      const first = reads;
      await act(() => vi.advanceTimersByTimeAsync(5100));
      expect(reads).toBeGreaterThan(first);
      await act(() => vi.advanceTimersByTimeAsync(125_000));
      const stopped = reads;
      await act(() => vi.advanceTimersByTimeAsync(60_000));
      expect(reads).toBe(stopped);
    } finally {
      vi.useRealTimers();
    }
  });

  it("기간이 끝난 옛 결제는 당시 결과와 현재 상태를 가르고 환불 버튼이 없다", async () => {
    renderIn(paymentDetail(OLD_PAYMENT));
    expect(
      await screen.findByText("이용 기간이 끝났습니다.")
    ).toBeInTheDocument();
    expect(screen.getByText(/첫 구매/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "환불 요청" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "문의·피드백" })).toBeVisible();
  });

  it("실패한 결제는 내부 코드 대신 사람 말로 사유를 적고, 코드는 문의용으로만 아래에 둔다", async () => {
    renderIn(paymentDetail("0P00000000001"));
    expect(
      await screen.findByText("카드사에서 결제를 승인하지 않았습니다.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("문의할 때 이 코드를 알려 주세요: INVALID_CARD")
    ).toBeInTheDocument();
    expect(screen.queryByText("코드 INVALID_CARD")).not.toBeInTheDocument();
  });

  it("결제 상세의 「문의·피드백」은 「결제·환불」을 골라 두고 결제 번호를 실어 보낸다", async () => {
    renderIn(paymentDetail(OLD_PAYMENT));
    fireEvent.click(await screen.findByRole("button", { name: "문의·피드백" }));
    expect(
      await screen.findByRole("radio", { name: /결제·환불/ })
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "환불해 주세요" },
    });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    await waitFor(() =>
      expect(mockDb.listFeedbacks().feedbacks).toContainEqual(
        expect.objectContaining({
          kind: "BILLING",
          message: expect.stringContaining(`\n결제 번호: ${OLD_PAYMENT}\n`),
        })
      )
    );
  });

  it("이 공간의 결제가 아니면 찾을 수 없다고 한다", async () => {
    renderIn(paymentDetail("0P00000000004"));
    expect(
      await screen.findByText("이 워크스페이스에서 이 결제를 찾을 수 없습니다.")
    ).toBeInTheDocument();
  });
});

describe("결제 내역 — 결제 관리 탭(공간)", () => {
  const history = () => screen.getByRole("region", { name: "결제 내역" });

  it("결제자가 누구든 이 공간의 결제를 결제자 이름과 함께 보이고, 12건 뒤는 더 보기로 펼친다", async () => {
    await openPaid();
    const list = await within(history()).findByRole("list", {
      name: "결제 내역",
    });
    // 「제품 팀」은 내 결제 셋 + 다른 관리자 열한 달 + 공간을 떠난 사람 한 건 = 15건이다.
    expect(within(list).getAllByRole("listitem")).toHaveLength(12);
    expect(within(list).getAllByText("박서연").length).toBeGreaterThan(0);
    expect(within(list).getAllByText("리서치 담당")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "더 보기 (3건)" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(15);
    expect(within(list).getByText("탈퇴한 멤버")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /더 보기/ })
    ).not.toBeInTheDocument();
    // 다른 공간의 결제는 이 탭에 없다.
    expect(screen.queryByText("지난 프로젝트 팀")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "이 워크스페이스의 결제 내역입니다. 관리자에게만 보입니다."
      )
    ).toBeInTheDocument();
    expect(events("billing_payment_history_viewed")).toEqual([{ scope: "workspace" }]);
  });

  it("행은 모두 그 결제의 상세로 들어간다", async () => {
    await openPaid();
    const rows = await within(history()).findAllByRole("button", {
      name: /결제 상세/,
    });
    expect(rows).toHaveLength(12);
    fireEvent.click(rows[0]);
    expect(
      await screen.findByRole("heading", { name: "결제 상세" })
    ).toBeInTheDocument();
  });

  it("결제가 없으면 빈 상태 문구를 보인다", async () => {
    server.use(
      http.get(`*/v1/workspaces/${PAID}/billing/payments`, () =>
        HttpResponse.json({
          success: true,
          error: null,
          data: { payments: [] },
        })
      )
    );
    await openPaid();
    expect(
      await screen.findByText("아직 결제한 내역이 없습니다.")
    ).toBeInTheDocument();
  });
});

describe("결제 내역 — 계정의 내 결제 내역", () => {
  const list = () => screen.findByRole("list", { name: "내 결제 내역" });

  it("내가 결제한 것만, 지운 공간의 결제도 결제 때 이름으로 보인다", async () => {
    renderIn(<MyPaymentsSettings />);
    const rows = within(await list()).getAllByRole("listitem");
    // 다른 관리자가 결제한 「제품 팀」 결제는 빠진다.
    expect(rows).toHaveLength(4);
    expect(screen.queryByText("박서연")).not.toBeInTheDocument();
    const deleted = screen.getByText("지난 프로젝트 팀").closest("li")!;
    expect(within(deleted).getByText("환불됨")).toBeInTheDocument();
    expect(within(deleted).getByText("2026년 8월 2일")).toBeInTheDocument();
    expect(screen.getAllByText("실패").length).toBeGreaterThan(0);
    expect(events("billing_payment_history_viewed")).toEqual([{ scope: "me" }]);
  });

  it("지금 ADMIN 인 공간의 결제만 상세로 들어가고, 돌아가면 목록이다", async () => {
    renderIn(<MyPaymentsSettings />);
    const deleted = (await screen.findByText("지난 프로젝트 팀")).closest(
      "li"
    )!;
    expect(within(deleted).queryByRole("button")).not.toBeInTheDocument();
    const rows = within(await list()).getAllByRole("button");
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toHaveTextContent("제품 팀");
    fireEvent.click(rows[0]);
    expect(
      await screen.findByRole("heading", { name: "결제 상세" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /내 결제 내역/ }));
    expect(await list()).toBeInTheDocument();
  });

  it("멤버로 내려간 공간의 결제는 상세로 들어가지 않는다", async () => {
    mockDb.changeMemberRole(PAID, mockDb.getCurrentUser().userId, "MEMBER");
    renderIn(<MyPaymentsSettings />);
    await screen.findByText("지난 프로젝트 팀");
    expect(within(await list()).queryAllByRole("button")).toEqual([]);
  });
});

// 결제 영수증(나이스페이 매출전표, APP-1600). 주소가 있는 결제에만 새 창 링크를 둔다.
describe("결제 영수증", () => {
  const history = () => screen.getByRole("region", { name: "결제 내역" });
  const receipt = (date: string) =>
    screen.queryByRole("link", { name: `${date} 결제 영수증 열기` });

  it("내역 행 끝에 새 창 링크로 두고, 주소가 없는 결제(실패·목의 빈 행)는 자리만 비운다. 환불된 결제에도 있다", async () => {
    await openPaid();
    await within(history()).findByRole("list", { name: "결제 내역" });
    fireEvent.click(screen.getByRole("button", { name: "더 보기 (3건)" }));
    const link = receipt("2026년 11월 11일")!;
    expect(link).toHaveAttribute(
      "href",
      "https://example.com/mock-receipt/0P00000000003"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("영수증");
    // 링크는 상세 버튼 밖에 있다(버튼 안 링크 금지).
    expect(link.closest("button")).toBeNull();
    // 실패한 결제(10월 11일 실패)와 목이 비워 둔 2025년 9월 11일 결제에는 없다.
    const failed = within(history()).getAllByText("실패")[0].closest("li")!;
    expect(within(failed).queryByRole("link")).not.toBeInTheDocument();
    expect(receipt("2025년 9월 11일")).not.toBeInTheDocument();

    cleanup();
    renderIn(<MyPaymentsSettings />);
    const refunded = (await screen.findByText("지난 프로젝트 팀")).closest(
      "li"
    )!;
    expect(
      within(refunded).getByRole("link", {
        name: "2026년 8월 2일 결제 영수증 열기",
      })
    ).toHaveAttribute("href", "https://example.com/mock-receipt/0P00000000004");
  });

  it("https 가 아닌 주소는 링크로 그리지 않는다", async () => {
    const { data } = await (
      await fetch(`http://localhost/v1/workspaces/${PAID}/billing/payments`)
    ).json();
    const [first, second] = data.payments;
    server.use(
      http.get(`*/v1/workspaces/${PAID}/billing/payments`, () =>
        HttpResponse.json({
          success: true,
          error: null,
          data: {
            payments: [
              {
                ...first,
                receiptUrl: "http://example.com/receipt",
              },
              {
                ...second,
                receiptUrl: "javascript:alert(1)",
              },
            ],
          },
        })
      )
    );
    await openPaid();
    await within(history()).findByRole("list", { name: "결제 내역" });
    expect(within(history()).queryAllByRole("link")).toEqual([]);
  });

  it("결제 상세에도 영수증 링크가 있다", async () => {
    renderIn(paymentDetail("0P00000000003"));
    expect(
      await screen.findByRole("link", {
        name: "2026년 11월 11일 결제 영수증 열기",
      })
    ).toHaveAttribute("target", "_blank");
  });

  it("영수증 주소가 없는 결제 상세에는 링크가 없다", async () => {
    renderIn(paymentDetail("0P00000000001"));
    await screen.findByText(/INVALID_CARD/);
    expect(screen.queryByRole("link", { name: /영수증/ })).toBeNull();
  });
});
