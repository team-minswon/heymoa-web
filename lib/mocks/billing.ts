import { delay, http } from "msw";

import { mockDb } from "@/lib/mocks/db";
import { failWith, paramId, respond } from "@/lib/mocks/mock-envelope";

/**
 * 결제 목 (PRO-75 · APP-1564). 서버 계약(`/v1/workspaces/{id}/billing` · `/v1/me/billing/setups/{id}` · 등록 열기·완료·취소)을 화면이 끝까지 따라갈 수 있게 흉내 낸다. **서버·PG 와의 정합성 증거가 아니다** — 상태 전이는 서버 DB·tick 이 아니라
 * 이 파일의 조회 횟수가 정한다.
 *
 * **시드.** 「테스트 유저의 워크스페이스」는 집행 대상·Free, 「제품 팀」은 이미 유료(ACTIVE), 「새 워크스페이스」는 집행 대상이
 * 아니다(`enforced=false`).
 *
 * **구매 흐름(APP-1600 나이스페이).** 등록 열기(201, CREATED — 카드를 기다린다) → 주문서가 카드 제출(`…/setups/{id}/card`)
 * → 처리를 시작하고 결과 화면으로 간다 → 상태를 몇 번 읽는 동안 카드 확인 중 → 결제 확인 중 → 시나리오의 결과.
 * **받은 카드 정보는 모양만 보고 버린다** — 상태·sessionStorage 어디에도 남기지 않는다.
 * 브라우저가 문서를 새로 열면 목의 메모리가 사라지므로 상태를 sessionStorage 에 남긴다.
 *
 * **재현 시나리오.** 등록을 열 때 `localStorage.mockBilling` 을 읽는다(없으면 `ok`).
 *   - `decline`  첫 구매 결제 확정 거절 → 카드가 지워지고 카드 등록부터 새로 시작(START_PURCHASE)
 *   - `unknown`  결제 결과 확인 지연(UNKNOWN)에서 멈춘다 — 새 결제 버튼이 없다
 *   - `stuck`    카드 등록 확인 중에서 멈춘다
 *   - `lost`     첫 조회부터 ACCESS_LOST(관리자 권한 상실)
 *   - `teamBusy` 다른 ADMIN 의 진행 중 구매가 있다(구매 시작 409 `BILLING_IN_PROGRESS`)
 *   - `refund`   승인은 됐지만 권한을 못 줘 자동 취소된다(보상 환불) — 취소 중 → 취소 완료, 새로 시작 가능
 *   - `quota`    무료 월 한도를 다 썼다 — 사용량이 한도와 같고 녹음 시작이 409 `RECORDING_QUOTA_EXCEEDED`(`billingMock.quotaExceeded()`)
 *   - `renewalChecking` 유료 공간의 갱신 결제 결과를 기다린다(RENEWAL_PENDING, 그동안 Pro). 해지 예약(CANCEL_SUBSCRIPTION)을 받고, 예약 뒤에는 같은 대기에 `cancelAtPeriodEnd=true`
   - `unpaid`   유료 공간의 갱신 결제가 확정 거절돼 구독이 끝났다(ENDED/UNPAID, 카드 지워짐)
   - `expired`  해지한 유료 구독의 기간이 끝났다(ENDED/EXPIRED, 카드 지워짐)
   - `salesPaused` 운영자가 새 판매를 멈췄다 — 유료 공간의 구독이 끝났고(ENDED/EXPIRED) 결제 화면은 보이지만(`enforced=true`)
     START_PURCHASE 가 없고, 한도 집행 대상이 아니라 사용량은 `enforced=false` 다
   - `recording` 이 공간에 아직 끝나지 않은 녹음이 있다(사용량 `recordingInProgress=true`)
 *   - `payerLeft` 유료 공간의 결제자가 빠져 자동 결제가 멈췄다(ACTIVE·종료 예정·카드 없음, CHANGE_CARD 만). 카드를 등록하면
 *     재개가 나오고 자동 결제 중단 알림이 한 건 있다
 *   - `otherPayer` 평소의 유료 공간인데 카드를 다른 관리자가 등록했다(`methodPayerIsMe=false`)
 *   - `replaceFail` 카드 변경(REPLACE)의 카드 등록이 실패한다 — 기존 카드가 그대로 남는다
 *   - `issueUnknown` 카드 제출의 발급 응답을 잃어 등록이 닫힌다(발급 결과 불명) — 결제 없음, 새 등록부터 다시
 *   - `cardInvalid` 카드 제출이 400(대행사가 카드 정보를 거절)이다
 *   - `cardRateLimited` 카드 제출이 429(카드 등록 시도 제한)이다
 *   - `statusHang` 등록 결과 조회(`/v1/me/billing/setups/{id}`)가 응답하지 않는다 — 결과 화면에 들어간 뒤 켜고 새로고침한다(조회 때 읽는다)
 *   - `unknownState` 등록 결과 조회가 web 이 모르는 단계(`stage: "NEW_STAGE"`, `status: "DECLINED"`)를 준다(조회 때 읽는다)
 * *   - `methodInUse` 결제 수단 삭제가 409 `BILLING_METHOD_IN_USE` 다
 * 지우려면 `localStorage.removeItem("mockBilling")`. 시험은 `billingMock.setScenario(...)`.
 *
 * **구매 이후(APP-1565).** 유료 공간(「제품 팀」)에서 해지 예약 → 재개, 카드 변경(REPLACE 등록 → 결과 화면), 해지 예약 뒤
 * 결제 수단 삭제를 밟을 수 있다. 환불은 문의로만 받아 목에 요청 경로가 없다. 결제 상세·내 결제 내역은 `state.payments` 가
 * 원본이고, 「지난 프로젝트 팀」은 지운 공간(목 DB 에 없다)의 결제다.
 *
 * 유료 상품의 녹음 제공량은 무제한(`null`)이다.
 */
export type BillingScenario =
  | "ok"
  | "decline"
  | "unknown"
  | "stuck"
  | "lost"
  | "teamBusy"
  | "refund"
  | "quota"
  | "renewalChecking"
  | "unpaid"
  | "expired"
  | "salesPaused"
  | "recording"
  | "payerLeft"
  | "otherPayer"
  | "replaceFail"
  | "issueUnknown"
  | "cardInvalid"
  | "cardRateLimited"
  | "statusHang"
  | "unknownState"
  | "methodInUse";

const SCENARIOS: BillingScenario[] = [
  "decline",
  "unknown",
  "stuck",
  "lost",
  "teamBusy",
  "refund",
  "quota",
  "renewalChecking",
  "unpaid",
  "expired",
  "salesPaused",
  "recording",
  "payerLeft",
  "otherPayer",
  "replaceFail",
  "issueUnknown",
  "cardInvalid",
  "cardRateLimited",
  "statusHang",
  "unknownState",
  "methodInUse",
];

type AttemptStatus =
  | "PENDING"
  | "PROCESSING"
  | "UNKNOWN"
  | "SUCCEEDED"
  | "FAILED";
type Attempt = {
  attemptId: string;
  cycleId: string;
  attemptNumber: number;
  status: AttemptStatus;
  errorCode: string | null;
  requiresManualReview: boolean;
  refundStatus?: "PROCESSING" | "SUCCEEDED";
};
type Card = {
  number: string | null;
  cardType: string | null;
  issuer: string | null;
};
type Notice = "SIMULATED_NO_CHARGE" | null;
type RefundStatus = "PENDING" | "PROCESSING" | "SUCCEEDED";
type Payment = {
  paymentId: string;
  workspaceId: string;
  /** 결제 때의 공간 이름(스냅샷). 공간을 지워도 남는다. */
  workspaceName: string;
  kind: "PURCHASE" | "RENEWAL";
  cycleId: string;
  attemptNumber: number;
  status: AttemptStatus;
  completedAt: string | null;
  period: { start: string; end: string } | null;
  amountKrw: number;
  errorCode: string | null;
  maskedCard: Card | null;
  refundStatus: RefundStatus | null;
  refundOrigin: "OPERATOR" | "COMPENSATION" | null;
  /** 결제자. 없으면 목 유저(나)다. 공간에 없는 사람이면 탈퇴한 결제자로 보인다. */
  payerUserId?: string;
};
type Setup = {
  setupId: string;
  workspaceId: string;
  purpose?: "PURCHASE" | "REPLACE";
  scenario: BillingScenario;
  notice: Notice;
  /** CREATED 는 카드를 기다린다. ISSUE_UNKNOWN 은 발급 응답을 잃어 닫혔다. */
  state: "CREATED" | "COMPLETING" | "CANCELED" | "ISSUE_UNKNOWN";
  polls: number;
  origin: Attempt | null;
  latest: Attempt | null;
};
type Workspace = {
  enforced: boolean;
  notice: Notice;
  paid: boolean;
  card: Card | null;
  /** 열린 청구 회차와 그 최신 시도. 결제가 성공하면 회차가 닫혀 null 이다. */
  cycle: { cycleId: string; attempt: Attempt } | null;
  /** 가장 최근에 환불이 걸린 시도(보상 환불). */
  refunded?: Attempt | null;
  mySetupId: string | null;
  subscriptionVersion: number;
  /** 갱신 결제의 결과를 기다리는 중인가(RENEWAL_PENDING). */
  renewalPending?: boolean;
  /** 끝난 구독(ENDED)의 까닭. */
  closedReason?: "REFUNDED" | "EXPIRED" | "UNPAID" | null;
  cancelAtPeriodEnd?: boolean;
  methodId?: string | null;
  methodVersion?: number;
  /** 지금 카드를 다른 관리자가 등록했다(`methodPayerIsMe=false`). */
  otherPayer?: boolean;
  /** 지금 유료 기간의 결제. */
  currentPaymentId?: string | null;
  /** 갱신 시나리오(`renewalChecking`·`unpaid`·`expired`·`salesPaused`·`payerLeft`·`otherPayer`)를 이미 적용했는가. */
  renewalApplied?: boolean;
  /** 새 판매가 멈춘 공간 — 결제 화면은 보이지만 새 구매가 없고 한도를 집행하지 않는다. */
  salesPaused?: boolean;
};
type State = {
  counter: number;
  workspaces: Record<string, Workspace>;
  setups: Record<string, Setup>;
  payments: Record<string, Payment>;
  keys: Record<string, { setupId: string; body: string }>;
};

const STORAGE_KEY = "heymoa:mock-billing";
const PRODUCT = {
  agreementVersion: "BILLING_TEST_V1",
  policyVersion: "TEST_MONTHLY_V1",
  amountKrw: 24900,
  recordingAllowanceMinutes: null as number | null,
  freeRecordingAllowanceMinutes: 1200,
  currency: "KRW",
  billingInterval: "MONTH",
  planCode: "PRO",
};
const FREE_ALLOWANCE_MINUTES = PRODUCT.freeRecordingAllowanceMinutes;
const PERIOD = {
  start: "2026-11-11T00:00:00+09:00",
  end: "2026-12-11T00:00:00+09:00",
};
const FULL_CARD: Card = {
  number: "4579-****-****-1234",
  cardType: "신용",
  issuer: "헤이모아카드",
};

const NEW_CARD: Card = {
  number: "5310-****-****-5678",
  cardType: "체크",
  issuer: "다른카드",
};
const PREVIOUS_PERIOD = {
  start: "2026-10-11T00:00:00+09:00",
  end: "2026-11-11T00:00:00+09:00",
};
const COMPLETED_AT = "2026-11-11T10:00:00+09:00";
const PAID_WORKSPACE = "01K0000000006";
const DELETED_WORKSPACE = "01K00000000ZZ";

let state: State;
let scenarioOverride: BillingScenario | null = null;

function seed(): State {
  const paidCard: Card = FULL_CARD;
  return {
    counter: 0,
    workspaces: {
      "01K0000000000": fresh({ notice: "SIMULATED_NO_CHARGE" }),
      // 이미 유료인 공간 — 실결제(`testPaymentNotice` 없음)로 보인다.
      [PAID_WORKSPACE]: {
        ...fresh({ notice: null }),
        paid: true,
        card: paidCard,
        subscriptionVersion: 2,
        methodId: "0M00000000001",
        methodVersion: 1,
        currentPaymentId: "0P00000000003",
      },
      "01K0000000009": { ...fresh({ notice: null }), enforced: false },
    },
    setups: {},
    payments: seedPayments(),
    keys: {},
  };
}

/** 유료 공간의 지난 결제(첫 구매 거절 → 새 카드로 구매 성공, 이번 달 갱신)와 지운 공간의 환불된 결제. */
function seedPayments(): Record<string, Payment> {
  const base = {
    workspaceId: PAID_WORKSPACE,
    workspaceName: "제품 팀",
    amountKrw: PRODUCT.amountKrw,
    refundStatus: null,
    refundOrigin: null,
  } as const;
  const list: Payment[] = [
    {
      ...base,
      paymentId: "0P00000000001",
      kind: "PURCHASE",
      cycleId: "0C00000000001",
      attemptNumber: 1,
      status: "FAILED",
      completedAt: "2026-10-11T09:10:00+09:00",
      period: PREVIOUS_PERIOD,
      errorCode: "INVALID_CARD",
      // 카드 등록이 끝나기 전에 거절된 시도라 카드 표시값이 없다.
      maskedCard: null,
    },
    {
      ...base,
      paymentId: "0P00000000002",
      kind: "PURCHASE",
      cycleId: "0C00000000004",
      attemptNumber: 1,
      status: "SUCCEEDED",
      completedAt: "2026-10-11T09:12:00+09:00",
      period: PREVIOUS_PERIOD,
      errorCode: null,
      maskedCard: FULL_CARD,
    },
    {
      ...base,
      paymentId: "0P00000000003",
      kind: "RENEWAL",
      cycleId: "0C00000000002",
      attemptNumber: 1,
      status: "SUCCEEDED",
      completedAt: "2026-11-11T09:05:00+09:00",
      period: PERIOD,
      errorCode: null,
      maskedCard: FULL_CARD,
    },
    {
      paymentId: "0P00000000004",
      workspaceId: DELETED_WORKSPACE,
      workspaceName: "지난 프로젝트 팀",
      kind: "PURCHASE",
      cycleId: "0C00000000003",
      attemptNumber: 1,
      status: "SUCCEEDED",
      completedAt: "2026-08-02T14:20:00+09:00",
      period: {
        start: "2026-08-02T00:00:00+09:00",
        end: "2026-09-02T00:00:00+09:00",
      },
      amountKrw: PRODUCT.amountKrw,
      errorCode: null,
      maskedCard: {
        number: "4579-****-****-1234",
        cardType: "신용",
        issuer: "헤이모아카드",
      },
      refundStatus: "SUCCEEDED",
      refundOrigin: "OPERATOR",
    },
  ];
  // 다른 관리자(박서연)가 결제하던 지난 구독 열두 달과, 이제 공간에 없는 사람이 결제한 한 건(APP-1596). 공간 결제 내역이
  // 12건을 넘어 「더 보기」가 보이고, 내 결제 내역에는 나오지 않는다.
  for (let month = 0; month < 12; month += 1) {
    const at = new Date(Date.UTC(2025, 8 + month, 11));
    const day = at.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(2025, 9 + month, 11))
      .toISOString()
      .slice(0, 10);
    list.push({
      ...base,
      paymentId: `0P0000000S${String(month).padStart(3, "0")}`,
      kind: month === 0 ? "PURCHASE" : "RENEWAL",
      cycleId: `0C0000000S${String(month).padStart(3, "0")}`,
      attemptNumber: 1,
      status: "SUCCEEDED",
      completedAt: `${day}T09:05:00+09:00`,
      period: { start: `${day}T00:00:00+09:00`, end: `${end}T00:00:00+09:00` },
      errorCode: null,
      maskedCard: NEW_CARD,
      payerUserId: month === 11 ? "01K0000000M99" : "01K0000000M21",
    });
  }
  return Object.fromEntries(
    list.map((payment) => [payment.paymentId, payment])
  );
}
function fresh(init: { notice: Notice }): Workspace {
  return {
    enforced: true,
    notice: init.notice,
    paid: false,
    card: null,
    cycle: null,
    mySetupId: null,
    subscriptionVersion: 1,
  };
}

function load(): State {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as State;
      stored.payments ??= seedPayments();
      return stored;
    }
  } catch {
    // 저장소를 못 쓰면 메모리만 쓴다.
  }
  return seed();
}
function save() {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장소를 못 쓰면 이 문서 안에서만 이어진다.
  }
}
function reset() {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
  scenarioOverride = null;
  state = seed();
}
state = load();
mockDb.onReset(reset);
// 카드 변경은 모달 안 iframe(다른 문서)이 낸다(APP-1600). 같은 탭의 sessionStorage 를 나눠 쓰는 그 문서가 상태를 바꾸면
// 이 문서의 목도 다시 읽어, 모달이 닫힌 뒤 결제 관리가 새 카드를 그린다(서버는 하나라 실제로는 저절로 맞다).
globalThis.addEventListener?.("storage", (event) => {
  if (
    event.key === STORAGE_KEY &&
    event.storageArea === globalThis.sessionStorage
  )
    state = load();
});

function currentScenario(): BillingScenario {
  if (scenarioOverride) return scenarioOverride;
  try {
    const value = globalThis.localStorage?.getItem("mockBilling");
    const found = SCENARIOS.find((scenario) => scenario === value);
    if (found) return found;
  } catch {
    // 손잡이 없이 연다.
  }
  return "ok";
}

const nextId = (prefix: string) =>
  `${prefix}${String((state.counter += 1)).padStart(12 - prefix.length, "0")}`;

/** 목 유저가 이 공간의 ADMIN 인가. 없는 공간은 404 로 던진다. */
function isAdmin(workspaceId: string) {
  return mockDb.getWorkspace(workspaceId).role === "ADMIN";
}
function workspaceOf(workspaceId: string) {
  mockDb.getWorkspace(workspaceId);
  state.workspaces[workspaceId] ??= fresh({ notice: "SIMULATED_NO_CHARGE" });
  return state.workspaces[workspaceId];
}
function requireAdmin(workspaceId: string) {
  if (!isAdmin(workspaceId))
    failWith("WORKSPACE_ACCESS_DENIED", 403, "관리자만 할 수 있습니다.");
}

const attemptView = (attempt: Attempt | null) =>
  attempt && {
    attemptId: attempt.attemptId,
    cycleId: attempt.cycleId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    errorCode: attempt.errorCode,
    requiresManualReview: attempt.requiresManualReview,
    refundStatus: attempt.refundStatus ?? null,
    refundOrigin: attempt.refundStatus ? "COMPENSATION" : null,
  };

function newAttempt(
  cycleId: string,
  attemptNumber: number,
  status: AttemptStatus
): Attempt {
  return {
    attemptId: nextId("0A"),
    cycleId,
    attemptNumber,
    status,
    errorCode: null,
    requiresManualReview: false,
  };
}

// ---- 공간 결제 조회 ----

function subscriptionStatus(ws: Workspace) {
  if (ws.closedReason) return "ENDED";
  return ws.paid ? "ACTIVE" : "FREE";
}

/** 실패한 시도를 결제 기록으로도 남긴다(결제 상세·내 결제 내역의 원본). */
function recordPayment(
  workspaceId: string,
  attempt: Attempt,
  kind: Payment["kind"],
  period: Payment["period"]
) {
  const ws = workspaceOf(workspaceId);
  const previous = state.payments[attempt.attemptId];
  const settled = attempt.status === "SUCCEEDED" || attempt.status === "FAILED";
  state.payments[attempt.attemptId] = {
    paymentId: attempt.attemptId,
    workspaceId,
    workspaceName:
      previous?.workspaceName ?? mockDb.getWorkspace(workspaceId).name,
    kind,
    cycleId: attempt.cycleId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    completedAt: settled ? (previous?.completedAt ?? COMPLETED_AT) : null,
    period: attempt.status === "SUCCEEDED" ? period : null,
    amountKrw: PRODUCT.amountKrw,
    errorCode: attempt.errorCode,
    maskedCard: previous?.maskedCard ?? ws.card,
    refundStatus: attempt.refundStatus ?? null,
    refundOrigin: attempt.refundStatus ? "COMPENSATION" : null,
  };
}

/**
 * 유료 공간에 갱신 시나리오를 한 번 적용한다. 결과를 기다리는 동안은 열린 회차와 RENEWAL_PENDING 지급이 있고, 확정 거절·기간 만료는
 * 그 자리에서 구독을 끝내고 카드를 지운다(서버의 빌링키 삭제 의도).
 */
function applyRenewal(ws: Workspace) {
  const scenario = currentScenario();
  if (
    !ws.paid ||
    ws.renewalApplied ||
    (scenario !== "renewalChecking" &&
      scenario !== "unpaid" &&
      scenario !== "expired" &&
      scenario !== "salesPaused" &&
      scenario !== "payerLeft" &&
      scenario !== "otherPayer")
  )
    return;
  ws.renewalApplied = true;
  if (scenario === "otherPayer") {
    ws.otherPayer = true;
    return;
  }
  if (scenario === "payerLeft") {
    // 서버가 결제자 이탈에 하는 일: 카드를 지우고 종료를 예약한다. 구독은 기간 끝까지 ACTIVE 다.
    ws.cancelAtPeriodEnd = true;
    ws.card = null;
    ws.methodId = null;
    ws.subscriptionVersion += 1;
    return;
  }
  if (scenario === "renewalChecking") {
    const cycleId = nextId("0C");
    ws.renewalPending = true;
    ws.cycle = { cycleId, attempt: newAttempt(cycleId, 1, "UNKNOWN") };
    return;
  }
  ws.paid = false;
  ws.salesPaused = scenario === "salesPaused";
  ws.closedReason = scenario === "unpaid" ? "UNPAID" : "EXPIRED";
  ws.cancelAtPeriodEnd = false;
  ws.currentPaymentId = null;
  ws.card = null;
  ws.methodId = null;
  ws.subscriptionVersion += 1;
}

function workspaceBilling(workspaceId: string) {
  const ws = workspaceOf(workspaceId);
  const admin = isAdmin(workspaceId);
  const teamBusy = currentScenario() === "teamBusy";
  if (!ws.enforced) {
    return {
      workspaceId,
      enforced: false,
      status: null,
      product: null,
      entitlement: null,
      currentPeriod: null,
      cancelAtPeriodEnd: false,
      mySetupId: null,
      teamSetupInProgress: false,
      latestAttemptStatus: null,
      allowedActions: [],
      detail: null,
      closedReason: null,
    };
  }
  applyRenewal(ws);
  const status = subscriptionStatus(ws);
  const cancel = Boolean(ws.cancelAtPeriodEnd);
  const attempt = ws.cycle?.attempt ?? null;
  const setup = ws.mySetupId ? state.setups[ws.mySetupId] : null;
  const actions: string[] = [];
  if (setup?.state === "CREATED")
    actions.push("CONTINUE_SETUP", "CANCEL_SETUP");
  else if (setup) actions.push("REFRESH_STATUS");
  else if (attempt) {
    actions.push("REFRESH_STATUS");
    // 갱신 결과를 기다리는 동안에도 해지를 예약할 수 있다(이미 예약했으면 없다).
    if (ws.renewalPending && !cancel) actions.push("CANCEL_SUBSCRIPTION");
  } else {
    if (!ws.paid && !teamBusy && !ws.salesPaused)
      actions.push("START_PURCHASE");
    const live = status === "ACTIVE" && !cancel;
    if (live) actions.push("CANCEL_SUBSCRIPTION");
    // 재개는 카드가 있어야 나온다(서버와 같다).
    if (status === "ACTIVE" && cancel && ws.card)
      actions.push("RESUME_SUBSCRIPTION");
    if (status === "ACTIVE") actions.push("CHANGE_CARD");
    if (ws.methodId && !live) actions.push("DELETE_PAYMENT_METHOD");
  }
  const entitlement = ws.renewalPending
    ? {
        kind: "RENEWAL_PENDING",
        period: PERIOD,
        recordingAllowanceMinutes: PRODUCT.recordingAllowanceMinutes,
        planCode: "PRO",
      }
    : ws.paid
      ? {
          kind: "PAID",
          period: PERIOD,
          recordingAllowanceMinutes: PRODUCT.recordingAllowanceMinutes,
          planCode: "PRO",
        }
      : {
          kind: "FREE",
          period: null,
          recordingAllowanceMinutes: FREE_ALLOWANCE_MINUTES,
          planCode: "FREE",
        };
  return {
    workspaceId,
    enforced: true,
    status,
    product: { ...PRODUCT, testPaymentNotice: ws.notice },
    entitlement,
    currentPeriod: ws.paid ? PERIOD : null,
    cancelAtPeriodEnd: cancel,
    mySetupId: admin ? ws.mySetupId : null,
    teamSetupInProgress: teamBusy,
    latestAttemptStatus: attempt?.status ?? null,
    allowedActions: admin ? actions : [],
    detail: admin
      ? {
          methodVersion: ws.card ? (ws.methodVersion ?? 1) : null,
          maskedCard: ws.card,
          latestAttempt: attemptView(attempt),
          refundedAttempt: attemptView(ws.refunded ?? null),
          subscriptionVersion: ws.subscriptionVersion,
          openCycleId: ws.cycle?.cycleId ?? null,
          methodPayerIsMe: Boolean(ws.card) && !ws.otherPayer,
          currentPaymentId: ws.currentPaymentId ?? null,
          methodId: ws.card ? (ws.methodId ?? null) : null,
          // 다음 갱신이 청구할 금액. 해지 예약·청구 중단·대기·Free 면 다음 결제가 없어 null 이다(서버와 같다).
          nextChargeAmountKrw:
            status === "ACTIVE" && !cancel && !ws.renewalPending
              ? PRODUCT.amountKrw
              : null,
        }
      : null,
    closedReason: status === "ENDED" ? (ws.closedReason ?? null) : null,
  };
}

// ---- 구매 이후의 명령 ----

type CommandBody = {
  requestKey?: string;
  expectedVersion?: number;
};
async function commandBody(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CommandBody;
  if (!body.requestKey) failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
  return body;
}
const STATE_CHANGED = () =>
  failWith(
    "BILLING_STATE_CHANGED",
    409,
    "결제 정보가 바뀌었습니다. 새로 고친 뒤 다시 시도해 주세요."
  );

function subscriptionState(workspaceId: string) {
  const ws = workspaceOf(workspaceId);
  return {
    subscriptionId: `0B${workspaceId.slice(2)}`,
    status: subscriptionStatus(ws),
    cancelAtPeriodEnd: Boolean(ws.cancelAtPeriodEnd),
    currentPeriod: ws.paid ? PERIOD : null,
    subscriptionVersion: ws.subscriptionVersion,
  };
}

async function changeSubscription(
  workspaceId: string,
  request: Request,
  cancel: boolean
) {
  requireAdmin(workspaceId);
  const ws = workspaceOf(workspaceId);
  const body = await commandBody(request);
  const replay = state.keys[`${workspaceId}:${body.requestKey}`];
  if (replay) return subscriptionState(workspaceId);
  if (
    subscriptionStatus(ws) !== "ACTIVE" ||
    body.expectedVersion !== ws.subscriptionVersion ||
    Boolean(ws.cancelAtPeriodEnd) === cancel
  )
    STATE_CHANGED();
  ws.cancelAtPeriodEnd = cancel;
  ws.subscriptionVersion += 1;
  state.keys[`${workspaceId}:${body.requestKey}`] = {
    setupId: "",
    body: cancel ? "cancel" : "resume",
  };
  return subscriptionState(workspaceId);
}

function deleteMethod(workspaceId: string, methodId: string) {
  requireAdmin(workspaceId);
  const ws = workspaceOf(workspaceId);
  const status = subscriptionStatus(ws);
  const live = status === "ACTIVE" && !ws.cancelAtPeriodEnd;
  if (live || currentScenario() === "methodInUse")
    failWith(
      "BILLING_METHOD_IN_USE",
      409,
      "구독에 쓰고 있는 카드라 삭제할 수 없습니다. 해지를 예약하거나 카드를 바꿔 주세요."
    );
  if (!ws.card || ws.methodId !== methodId)
    failWith(
      "BILLING_PAYMENT_METHOD_NOT_FOUND",
      404,
      "결제 수단을 찾을 수 없습니다."
    );
  ws.card = null;
  ws.methodId = null;
}

function paymentView(payment: Payment) {
  const { payerUserId, ...rest } = payment;
  return {
    ...rest,
    currency: "KRW",
    payerIsMe: !payerUserId,
    // 나이스페이 매출전표(APP-1600). 승인된 결제에만 있고, 가장 오래된 갱신 한 건은 비워 빈 자리도 보이게 한다.
    receiptUrl:
      payment.status === "SUCCEEDED" && payment.paymentId !== "0P0000000S000"
        ? `https://example.com/mock-receipt/${payment.paymentId}`
        : null,
    cycleStatus:
      payment.refundStatus === "SUCCEEDED"
        ? "REFUNDED"
        : payment.status === "SUCCEEDED"
          ? "PAID"
          : "OPEN",
  };
}

function workspacePayment(workspaceId: string, paymentId: string) {
  requireAdmin(workspaceId);
  const payment = state.payments[paymentId];
  if (!payment || payment.workspaceId !== workspaceId)
    failWith("BILLING_PAYMENT_NOT_FOUND", 404, "결제를 찾을 수 없습니다.");
  return paymentView(payment);
}

/** 최신순. 확인 중인 결제(완료 시각 없음)가 맨 위다. */
function latestFirst(payments: Payment[]) {
  const order = (payment: Payment) => payment.completedAt ?? "9999";
  return payments.sort((a, b) =>
    order(b) === order(a)
      ? b.paymentId.localeCompare(a.paymentId)
      : order(b).localeCompare(order(a))
  );
}

/** 내가 결제자인 결제, 최신순. 다른 관리자가 결제한 것은 빠진다. */
function myPayments() {
  return {
    payments: latestFirst(
      Object.values(state.payments).filter((payment) => !payment.payerUserId)
    ).map(paymentView),
  };
}

/** 이 공간의 결제 전부(결제자 무관), 최신순. ADMIN 만. 결제자 이름은 지금 멤버 명단에서 찾고 없으면 null(탈퇴)이다. */
function workspacePayments(workspaceId: string) {
  requireAdmin(workspaceId);
  const members = mockDb.listMembers(workspaceId);
  const me = mockDb.getCurrentUser();
  return {
    payments: latestFirst(
      Object.values(state.payments).filter(
        (payment) => payment.workspaceId === workspaceId
      )
    ).map((payment) => {
      const payerId = payment.payerUserId ?? me.userId;
      return {
        ...paymentView(payment),
        // 공간 내역은 카드 표시값을 주지 않는다(서버와 같다).
        maskedCard: undefined,
        payerName:
          members.find((member) => member.userId === payerId)?.name ?? null,
      };
    }),
  };
}

// ---- 녹음 사용량 ----

const SAMPLE_RATE = 16_000;
const samplesOf = (minutes: number) => minutes * 60 * SAMPLE_RATE;
const FREE_USED_MINUTES = 45;
const PAID_USED_MINUTES = 330;
const FREE_USAGE_PERIOD = {
  start: "2026-11-01T00:00:00+09:00",
  end: "2026-12-01T00:00:00+09:00",
};

/** 집행 Free·집행 Pro·비집행 셋이 서로 다른 모양이다. 분 값은 서버가 내림해 주는 값이라 목도 정수로 준다. */
function recordingUsage(workspaceId: string) {
  const ws = workspaceOf(workspaceId);
  // 결제 조회보다 먼저 와도 같은 시나리오를 본다.
  if (ws.enforced) applyRenewal(ws);
  if (!ws.enforced || ws.salesPaused) {
    return {
      enforced: false,
      periodKind: null,
      periodStart: null,
      periodEnd: null,
      unlimited: null,
      sampleRate: null,
      allowanceSamples: null,
      usedSamples: null,
      remainingSamples: null,
      allowanceMinutes: null,
      usedMinutes: null,
      remainingMinutes: null,
      recordingInProgress: null,
    };
  }
  const recordingInProgress = currentScenario() === "recording";
  if (ws.paid) {
    return {
      enforced: true,
      periodKind: "PAID",
      periodStart: PERIOD.start,
      periodEnd: PERIOD.end,
      unlimited: true,
      sampleRate: SAMPLE_RATE,
      allowanceSamples: null,
      usedSamples: samplesOf(PAID_USED_MINUTES),
      remainingSamples: null,
      allowanceMinutes: null,
      usedMinutes: PAID_USED_MINUTES,
      remainingMinutes: null,
      recordingInProgress,
    };
  }
  const used =
    currentScenario() === "quota" ? FREE_ALLOWANCE_MINUTES : FREE_USED_MINUTES;
  return {
    enforced: true,
    periodKind: "FREE",
    periodStart: FREE_USAGE_PERIOD.start,
    periodEnd: FREE_USAGE_PERIOD.end,
    unlimited: false,
    sampleRate: SAMPLE_RATE,
    allowanceSamples: samplesOf(FREE_ALLOWANCE_MINUTES),
    usedSamples: samplesOf(used),
    remainingSamples: samplesOf(FREE_ALLOWANCE_MINUTES - used),
    allowanceMinutes: FREE_ALLOWANCE_MINUTES,
    usedMinutes: used,
    remainingMinutes: FREE_ALLOWANCE_MINUTES - used,
    recordingInProgress,
  };
}

// ---- 등록 상태 ----

type Phase = {
  stage: string;
  status: string;
  setupStatus: string;
  actions: string[];
  poll: number | null;
};
const phase = (
  stage: string,
  status: string,
  setupStatus: string,
  actions: string[],
  poll: number | null
): Phase => ({ stage, status, setupStatus, actions, poll });

/** 조회 횟수로 상태를 한 칸씩 옮기고, 그 결과를 공간 상태에 반영한다. 같은 횟수에는 같은 결과(멱등)다. */
function advance(setup: Setup): Phase {
  const ws = workspaceOf(setup.workspaceId);
  // 서버의 `BillingSetupViewHandler.restart` 와 같다: 취소·발급 불명·발급 거절은 다시 읽지 않고 「새로 시작」을 준다.
  if (setup.state === "CANCELED")
    return phase("CLOSED", "CANCELED", "CANCELED", ["START_PURCHASE"], null);
  if (setup.state === "ISSUE_UNKNOWN")
    return phase(
      "BILLING_KEY",
      "UNKNOWN",
      "ISSUE_UNKNOWN",
      ["START_PURCHASE"],
      null
    );
  if (setup.state === "CREATED")
    return phase(
      "CARD_AUTH_REQUIRED",
      "WAITING",
      "CREATED",
      ["CONTINUE_SETUP", "CANCEL_SETUP"],
      null
    );
  if (setup.scenario === "lost") {
    return phase("ACCESS_LOST", "ACTION_REQUIRED", "ISSUING", [], null);
  }
  if (setup.scenario === "stuck")
    return phase("BILLING_KEY", "PROCESSING", "ISSUING", ["REFRESH_STATUS"], 2);
  if (setup.purpose === "REPLACE") return advanceReplace(setup, ws);

  const cycleId = setup.origin?.cycleId ?? nextId("0C");

  const n = setup.polls;
  if (n <= 1)
    return phase("BILLING_KEY", "PROCESSING", "ISSUING", ["REFRESH_STATUS"], 2);
  ws.mySetupId = null;
  ws.card ??=
    setup.scenario === "refund"
      ? { number: "4579-****-****-9999", cardType: null, issuer: null }
      : setup.scenario === "unknown"
        ? { number: null, cardType: "체크", issuer: "헤이모아카드" }
        : FULL_CARD;
  const origin = (setup.origin ??= newAttempt(cycleId, 1, "PROCESSING"));
  setup.latest = origin;
  ws.cycle = { cycleId, attempt: origin };
  if (n === 2) {
    origin.status = "PROCESSING";
    return phase("PAYMENT", "PROCESSING", "ISSUED", ["REFRESH_STATUS"], 2);
  }
  if (setup.scenario === "decline") {
    // 확정 거절은 그 자리에서 끝난다 — 회차를 닫고 카드를 지운다. 다시 쓰려면 카드 등록부터 새로 한다.
    origin.status = "FAILED";
    origin.errorCode = "CARD_DECLINED";
    ws.cycle = null;
    ws.card = null;
    ws.methodId = null;
    return phase("PAYMENT", "DECLINED", "ISSUED", ["START_PURCHASE"], null);
  }
  if (setup.scenario === "unknown") {
    origin.status = "UNKNOWN";
    return phase("PAYMENT", "UNKNOWN", "ISSUED", ["REFRESH_STATUS"], 5);
  }
  if (n === 3)
    return phase("ACCESS", "PROCESSING", "ISSUED", ["REFRESH_STATUS"], 2);
  if (setup.scenario === "refund") {
    origin.status = "SUCCEEDED";
    ws.refunded = origin;
    if (n === 4) {
      // 취소가 끝나기 전에는 공간 조회의 최신 시도에도 환불 상태가 실린다(새 구매는 막힌다).
      ws.cycle = { cycleId, attempt: origin };
      origin.refundStatus = "PROCESSING";
      return phase("ACCESS", "PROCESSING", "ISSUED", ["REFRESH_STATUS"], 2);
    }
    origin.refundStatus = "SUCCEEDED";
    ws.cycle = null;
    return phase("ACCESS", "CANCELED", "ISSUED", ["START_PURCHASE"], null);
  }
  origin.status = "SUCCEEDED";
  markPaid(ws, origin);
  return phase("COMPLETED", "COMPLETED", "ISSUED", [], null);
}

function markPaid(ws: Workspace, attempt: Attempt) {
  // 옛 완료 등록을 다시 읽어도 이미 지급한 결제로 끝난 구독을 되살리지 않는다.
  const granted = state.payments[attempt.attemptId]?.status === "SUCCEEDED";
  if (!ws.paid && !granted) {
    ws.paid = true;
    ws.closedReason = null;
    ws.cancelAtPeriodEnd = false;
    ws.currentPaymentId = attempt.attemptId;
    ws.methodId ??= nextId("0M");
    ws.methodVersion ??= 1;
  }
  ws.cycle = null;
}

/** 카드 변경. 카드 등록만 하고 청구하지 않는다 — 실패하면 기존 카드가 그대로다. */
function advanceReplace(setup: Setup, ws: Workspace): Phase {
  if (setup.polls <= 1)
    return phase("BILLING_KEY", "PROCESSING", "ISSUING", ["REFRESH_STATUS"], 2);
  if (ws.mySetupId === setup.setupId) {
    ws.mySetupId = null;
    if (setup.scenario !== "replaceFail") {
      ws.card = NEW_CARD;
      ws.otherPayer = false;
      ws.methodVersion = (ws.methodVersion ?? 1) + 1;
      ws.methodId = nextId("0M");
    }
  }
  if (setup.scenario === "replaceFail")
    return phase(
      "BILLING_KEY",
      "DECLINED",
      "ISSUE_REJECTED",
      ["START_PURCHASE"],
      null
    );
  return phase("COMPLETED", "COMPLETED", "ISSUED", [], null);
}

function setupStatus(setup: Setup, tick: boolean) {
  if (tick && setup.state === "COMPLETING") setup.polls += 1;
  const p = advance(setup);
  for (const attempt of [setup.origin, setup.latest])
    if (attempt) recordPayment(setup.workspaceId, attempt, "PURCHASE", PERIOD);
  const lost = p.stage === "ACCESS_LOST";
  const completed = p.stage === "COMPLETED";
  return {
    setupId: setup.setupId,
    workspaceId: lost ? null : setup.workspaceId,
    purpose: setup.purpose ?? "PURCHASE",
    statusUrl: `/v1/me/billing/setups/${setup.setupId}`,
    setupStatus: p.setupStatus,
    stage: p.stage,
    status: p.status,
    failureCode: setup.state === "CANCELED" ? "CANCELED_BY_USER" : null,
    allowedActions: p.actions,
    amountKrw: lost ? null : PRODUCT.amountKrw,
    paidPeriod: completed ? PERIOD : null,
    latestAttempt: attemptView(setup.latest),
    originAttempt: attemptView(setup.origin),
    testPaymentNotice: lost ? null : setup.notice,
    planCode: lost ? null : PRODUCT.planCode,
    provider: lost ? null : "FAKE",
    pollAfterSeconds: p.poll,
  };
}

function setupOf(setupId: string) {
  const setup = state.setups[setupId];
  if (!setup)
    failWith("BILLING_SETUP_NOT_FOUND", 404, "카드 등록을 찾을 수 없습니다.");
  return setup;
}

// ---- 등록 열기 ----

async function createSetup(workspaceId: string, request: Request) {
  requireAdmin(workspaceId);
  const ws = workspaceOf(workspaceId);
  if (!ws.enforced)
    failWith(
      "BILLING_NOT_AVAILABLE",
      403,
      "이 공간은 아직 요금제 대상이 아닙니다."
    );
  const body = (await request.json().catch(() => ({}))) as {
    requestKey?: string;
    purpose?: string;
    expectedProductVersion?: string;
    agreementVersion?: string;
  };
  const purpose =
    body.purpose === "PURCHASE" || body.purpose === "REPLACE"
      ? body.purpose
      : null;
  if (!body.requestKey || !purpose || !body.agreementVersion)
    failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
  const bodyKey = JSON.stringify([
    body.purpose,
    body.expectedProductVersion,
    body.agreementVersion,
  ]);
  const stored = state.keys[`${workspaceId}:${body.requestKey}`];
  if (stored) {
    if (stored.body !== bodyKey)
      failWith(
        "REQUEST_KEY_CONFLICT",
        409,
        "같은 요청 키에 다른 내용을 보낼 수 없습니다."
      );
    return {
      setup: createdView(state.setups[stored.setupId]),
      status: 200,
    };
  }
  if (currentScenario() === "teamBusy")
    failWith("BILLING_IN_PROGRESS", 409, "팀의 구독 처리가 진행 중입니다.");
  if (
    body.expectedProductVersion !== PRODUCT.policyVersion ||
    body.agreementVersion !== PRODUCT.agreementVersion
  )
    failWith(
      "BILLING_STATE_CHANGED",
      409,
      "상품이 바뀌었습니다. 다시 확인해 주세요."
    );
  if (purpose === "PURCHASE" && ws.paid)
    failWith("BILLING_STATE_CHANGED", 409, "이미 유료 요금제입니다.");
  // 카드 변경은 지금 유료(ACTIVE)인 구독의 카드만 바꾼다.
  if (purpose === "REPLACE" && !ws.paid) STATE_CHANGED();
  const mine = ws.mySetupId ? state.setups[ws.mySetupId] : null;
  if (mine) {
    state.keys[`${workspaceId}:${body.requestKey}`] = {
      setupId: mine.setupId,
      body: bodyKey,
    };
    return { setup: createdView(mine), status: 200 };
  }
  const setup: Setup = {
    setupId: nextId("0S"),
    workspaceId,
    purpose,
    scenario: currentScenario(),
    notice: ws.notice,
    state: "CREATED",
    polls: 0,
    origin: null,
    latest: null,
  };
  state.setups[setup.setupId] = setup;
  state.keys[`${workspaceId}:${body.requestKey}`] = {
    setupId: setup.setupId,
    body: bodyKey,
  };
  ws.mySetupId = setup.setupId;
  return { setup: createdView(setup), status: 201 };
}

/** 카드 제출. 본문은 모양만 보고 버린다(카드 정보를 어디에도 남기지 않는다). */
async function submitCard(
  workspaceId: string,
  setupId: string,
  request: Request
) {
  requireAdmin(workspaceId);
  // 서버 계약: PG 발급까지 간 제출이 사용자당 10분 5회·공간당 1시간 10회를 넘으면 PG 를 부르지 않고 429 다.
  if (currentScenario() === "cardRateLimited")
    failWith(
      "BILLING_CARD_RATE_LIMITED",
      429,
      "카드 등록 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
    );
  const setup = setupOf(setupId);
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const digits = (key: string, ...lengths: number[]) =>
    typeof body[key] === "string" &&
    /^\d+$/.test(body[key]) &&
    lengths.includes(body[key].length);
  const wellFormed =
    digits("cardNumber", 14, 15, 16) &&
    digits("expiryMonth", 2) &&
    digits("expiryYear", 2) &&
    digits("identity", 6, 10) &&
    digits("passwordPrefix", 2);
  // 거절은 제출할 때의 시나리오를 본다 — 시나리오를 지우고 다시 내면 같은 등록으로 이어 간다.
  if (!wellFormed || currentScenario() === "cardInvalid")
    failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
  if (setup.state !== "CREATED")
    failWith("BILLING_IN_PROGRESS", 409, "팀의 구독 처리가 진행 중입니다.");
  const ws = workspaceOf(workspaceId);
  if (setup.scenario === "issueUnknown") {
    setup.state = "ISSUE_UNKNOWN";
    if (ws.mySetupId === setup.setupId) ws.mySetupId = null;
  } else setup.state = "COMPLETING";
  // 서버는 발급을 요청 안에서 끝내고 결과 상태를 돌려준다(SubmitBillingCardService). 카드 변경은 발급이 곧 끝이라 바로 결과다.
  if (setup.purpose === "REPLACE") setup.polls = 2;
  return setupStatus(setup, false);
}

function createdView(setup: Setup) {
  return {
    setupId: setup.setupId,
    purpose: setup.purpose ?? "PURCHASE",
    status: setup.state === "CANCELED" ? "CANCELED" : "CREATED",
    provider: "FAKE",
    planCode: PRODUCT.planCode,
    amountKrw: PRODUCT.amountKrw,
    currency: PRODUCT.currency,
    recordingAllowanceMinutes: PRODUCT.recordingAllowanceMinutes,
    agreementVersion: PRODUCT.agreementVersion,
    testPaymentNotice: setup.notice,
    expiresAt: "2026-11-11T01:00:00+09:00",
    statusUrl: `/v1/me/billing/setups/${setup.setupId}`,
    // 나이스페이는 결제창이 없다 — 카드는 주문서가 따로 낸다(`submitCard`).
  };
}

export const billingHandlers = [
  http.get("*/v1/workspaces/:workspaceId/billing", ({ params }) =>
    respond(() => workspaceBilling(paramId(params.workspaceId)))
  ),
  http.get("*/v1/workspaces/:workspaceId/billing/usage", ({ params }) =>
    respond(() => recordingUsage(paramId(params.workspaceId)))
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/billing/setups",
    async ({ params, request }) => {
      // 새로 만들면 201, 같은 키·진행 중 등록을 돌려받으면 200 이라 상태를 정한 뒤 봉투로 감싼다.
      try {
        const { setup, status } = await createSetup(
          paramId(params.workspaceId),
          request
        );
        save();
        return respond(() => setup, status);
      } catch (error) {
        return respond(() => {
          throw error;
        });
      }
    }
  ),
  http.get("*/v1/me/billing/setups/:setupId", async ({ params }) => {
    if (currentScenario() === "statusHang") await delay("infinite");
    return respond(() => {
      const view = setupStatus(setupOf(paramId(params.setupId)), true);
      save();
      return currentScenario() === "unknownState"
        ? { ...view, stage: "NEW_STAGE", status: "DECLINED" }
        : view;
    });
  }),
  http.post(
    "*/v1/workspaces/:workspaceId/billing/setups/:setupId/card",
    ({ params, request }) =>
      respond(async () => {
        const view = await submitCard(
          paramId(params.workspaceId),
          paramId(params.setupId),
          request
        );
        save();
        return view;
      })
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/billing/setups/:setupId/cancel",
    ({ params }) =>
      respond(() => {
        requireAdmin(paramId(params.workspaceId));
        const setup = setupOf(paramId(params.setupId));
        if (setup.state === "COMPLETING")
          failWith(
            "BILLING_STATE_CHANGED",
            409,
            "이미 처리가 시작되어 취소할 수 없습니다."
          );
        setup.state = "CANCELED";
        const ws = workspaceOf(setup.workspaceId);
        if (ws.mySetupId === setup.setupId) ws.mySetupId = null;
        const view = setupStatus(setup, false);
        save();
        return view;
      })
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/billing/subscription/cancel",
    ({ params, request }) =>
      respond(async () => {
        const view = await changeSubscription(
          paramId(params.workspaceId),
          request,
          true
        );
        save();
        return view;
      })
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/billing/subscription/resume",
    ({ params, request }) =>
      respond(async () => {
        const view = await changeSubscription(
          paramId(params.workspaceId),
          request,
          false
        );
        save();
        return view;
      })
  ),
  http.get(
    "*/v1/workspaces/:workspaceId/billing/payments/:paymentId",
    ({ params }) =>
      respond(() => {
        const view = workspacePayment(
          paramId(params.workspaceId),
          paramId(params.paymentId)
        );
        save();
        return view;
      })
  ),
  http.get("*/v1/me/billing/payments", () => respond(myPayments)),
  http.get("*/v1/workspaces/:workspaceId/billing/payments", ({ params }) =>
    respond(() => workspacePayments(paramId(params.workspaceId)))
  ),
  http.delete(
    "*/v1/workspaces/:workspaceId/billing/payment-methods/:methodId",
    ({ params }) =>
      respond(() => {
        deleteMethod(paramId(params.workspaceId), paramId(params.methodId));
        save();
      }, 204)
  ),
];

/**
 * 시나리오 `unpaid` 에서는 「제품 팀」의 구독 종료 알림(APP-1565)을, `payerLeft` 에서는 자동 결제 중단 알림(APP-1588)을 알림 목록에
 * 한 번 넣는다. 기본 목에서는 그 공간이 평소의 Pro 라 넣지 않는다. 알림 조회 목이 부른다.
 */
const BILLING_NOTICES = {
  unpaid: {
    notificationId: "01K0000000090",
    type: "SUBSCRIPTION_ENDED_UNPAID",
  },
  payerLeft: {
    notificationId: "01K0000000091",
    type: "SUBSCRIPTION_BILLING_STOPPED",
  },
} as const;
function ensureBillingNotice() {
  const scenario = currentScenario();
  if (scenario !== "unpaid" && scenario !== "payerLeft") return;
  mockDb.pushNotification({
    ...BILLING_NOTICES[scenario],
    readAt: null,
    createdAt: new Date().toISOString(),
    invitation: null,
    payload: {
      workspaceId: "01K0000000006",
      workspaceName: "제품 팀",
      invitationId: null,
      inviterUserId: null,
      noteId: null,
      noteTitle: null,
      autoEnded: null,
      pausedBusinessDays: null,
      feedbackId: null,
    },
  });
}

/** 시험·콘솔용 손잡이. */
export const billingMock = {
  ensureBillingNotice,
  setScenario(scenario: BillingScenario | null) {
    scenarioOverride = scenario;
  },
  /** 시나리오 `quota` 인가 — 녹음 시작 목이 409 를 내는 조건이다. */
  quotaExceeded: () => currentScenario() === "quota",
  setupIds: () => Object.keys(state.setups),
  /** 결제 상세 표본용 — 그 결제의 공간과 함께. */
  payments: () =>
    Object.values(state.payments).map(({ workspaceId, paymentId }) => ({
      workspaceId,
      paymentId,
    })),
};
