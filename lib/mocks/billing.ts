import { delay, http } from "msw";

import { mockDb } from "@/lib/mocks/db";
import { failWith, paramId, respond } from "@/lib/mocks/mock-envelope";

type BillingScenario =
  | "ok"
  | "decline"
  | "notProcessed"
  | "unknown"
  | "stuck"
  | "lost"
  | "teamBusy"
  | "refund"
  | "quota"
  | "renewalChecking"
  | "unpaid"
  | "expired"
  | "pastDue"
  | "pastDueDecline"
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
  "notProcessed",
  "unknown",
  "stuck",
  "lost",
  "teamBusy",
  "refund",
  "quota",
  "renewalChecking",
  "unpaid",
  "expired",
  "pastDue",
  "pastDueDecline",
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
  payerUserId?: string;
};
type Setup = {
  setupId: string;
  workspaceId: string;
  purpose?: "PURCHASE" | "REPLACE";
  scenario: BillingScenario;
  notice: Notice;
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
  cycle: { cycleId: string; attempt: Attempt } | null;
  refunded?: Attempt | null;
  mySetupId: string | null;
  subscriptionVersion: number;
  renewalPending?: boolean;
  pastDue?: boolean;
  closedReason?: "REFUNDED" | "EXPIRED" | "UNPAID" | null;
  cancelAtPeriodEnd?: boolean;
  methodId?: string | null;
  methodVersion?: number;
  otherPayer?: boolean;
  currentPaymentId?: string | null;
  renewalApplied?: boolean;
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
const PAST_DUE_ENDS_AT = "2026-12-14T10:00:00+09:00";
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
  } catch {}
  return seed();
}
function save() {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}
function reset() {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {}
  scenarioOverride = null;
  state = seed();
}
state = load();
mockDb.onReset(reset);
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
  } catch {}
  return "ok";
}

const nextId = (prefix: string) =>
  `${prefix}${String((state.counter += 1)).padStart(13 - prefix.length, "0")}`;

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

function subscriptionStatus(ws: Workspace) {
  if (ws.closedReason) return "ENDED";
  if (ws.pastDue) return "PAST_DUE";
  return ws.paid ? "ACTIVE" : "FREE";
}

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

function applyRenewal(ws: Workspace) {
  const scenario = currentScenario();
  if (
    !ws.paid ||
    ws.renewalApplied ||
    (scenario !== "renewalChecking" &&
      scenario !== "pastDue" &&
      scenario !== "pastDueDecline" &&
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
    ws.cancelAtPeriodEnd = true;
    ws.card = null;
    ws.methodId = null;
    ws.subscriptionVersion += 1;
    return;
  }
  if (scenario === "pastDue" || scenario === "pastDueDecline") {
    const cycleId = nextId("0C");
    const attempt = newAttempt(cycleId, 1, "FAILED");
    attempt.errorCode = "CARD_DECLINED";
    ws.pastDue = true;
    ws.renewalPending = true;
    ws.cycle = { cycleId, attempt };
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
  else if (ws.pastDue) {
    if (attempt?.status === "PROCESSING") actions.push("REFRESH_STATUS");
    else actions.push("CHANGE_CARD", "CANCEL_SUBSCRIPTION");
  } else if (attempt) {
    actions.push("REFRESH_STATUS");
    if (ws.renewalPending && !cancel) actions.push("CANCEL_SUBSCRIPTION");
  } else {
    if (!ws.paid && !teamBusy && !ws.salesPaused)
      actions.push("START_PURCHASE");
    const live = status === "ACTIVE" && !cancel;
    if (live) actions.push("CANCEL_SUBSCRIPTION");
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
          nextChargeAmountKrw:
            status === "ACTIVE" && !cancel && !ws.renewalPending
              ? PRODUCT.amountKrw
              : null,
        }
      : null,
    closedReason: status === "ENDED" ? (ws.closedReason ?? null) : null,
    pastDueEndsAt: status === "PAST_DUE" ? PAST_DUE_ENDS_AT : null,
  };
}

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
  if (cancel && ws.pastDue && body.expectedVersion === ws.subscriptionVersion) {
    ws.pastDue = false;
    ws.renewalPending = false;
    ws.paid = false;
    ws.cycle = null;
    ws.closedReason = "EXPIRED";
    ws.currentPaymentId = null;
    ws.subscriptionVersion += 1;
    state.keys[`${workspaceId}:${body.requestKey}`] = {
      setupId: "",
      body: "cancel",
    };
    return subscriptionState(workspaceId);
  }
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
    failWith("NOT_FOUND", 404, "요청한 내용을 찾을 수 없습니다.");
  return paymentView(payment);
}

function latestFirst(payments: Payment[]) {
  const order = (payment: Payment) => payment.completedAt ?? "9999";
  return payments.sort((a, b) =>
    order(b) === order(a)
      ? b.paymentId.localeCompare(a.paymentId)
      : order(b).localeCompare(order(a))
  );
}

function myPayments() {
  return {
    payments: latestFirst(
      Object.values(state.payments).filter((payment) => !payment.payerUserId)
    ).map(paymentView),
  };
}

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
        maskedCard: undefined,
        payerName:
          members.find((member) => member.userId === payerId)?.name ?? null,
      };
    }),
  };
}

const SAMPLE_RATE = 16_000;
const samplesOf = (minutes: number) => minutes * 60 * SAMPLE_RATE;
const FREE_USED_MINUTES = 45;
const PAID_USED_MINUTES = 330;
const FREE_USAGE_PERIOD = {
  start: "2026-11-01T00:00:00+09:00",
  end: "2026-12-01T00:00:00+09:00",
};

function recordingUsage(workspaceId: string) {
  const ws = workspaceOf(workspaceId);
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

function advance(setup: Setup): Phase {
  const ws = workspaceOf(setup.workspaceId);
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
  if (setup.scenario === "decline" || setup.scenario === "notProcessed") {
    origin.status = "FAILED";
    origin.errorCode =
      setup.scenario === "notProcessed"
        ? "NET_CANCEL_NOT_FOUND"
        : "CARD_DECLINED";
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

function advanceReplace(setup: Setup, ws: Workspace): Phase {
  if (setup.polls <= 1)
    return phase("BILLING_KEY", "PROCESSING", "ISSUING", ["REFRESH_STATUS"], 2);
  if (ws.pastDue || setup.origin) return advancePastDueCharge(setup, ws);
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

function advancePastDueCharge(setup: Setup, ws: Workspace): Phase {
  const cycle = ws.cycle;
  if (!setup.origin && cycle) {
    ws.mySetupId = null;
    ws.card = NEW_CARD;
    ws.methodId = nextId("0M");
    ws.methodVersion = (ws.methodVersion ?? 1) + 1;
    setup.origin = setup.latest = newAttempt(
      cycle.cycleId,
      cycle.attempt.attemptNumber + 1,
      "PROCESSING"
    );
    ws.cycle = { cycleId: cycle.cycleId, attempt: setup.origin };
  }
  const origin = setup.origin;
  if (!origin) return phase("COMPLETED", "COMPLETED", "ISSUED", [], null);
  if (setup.polls <= 3)
    return phase("PAYMENT", "PROCESSING", "ISSUED", ["REFRESH_STATUS"], 2);
  if (setup.scenario === "pastDueDecline" || origin.status === "FAILED") {
    if (origin.status !== "FAILED") {
      origin.status = "FAILED";
      origin.errorCode = "CARD_DECLINED";
      ws.card = null;
      ws.methodId = null;
    }
    return phase("PAYMENT", "DECLINED", "ISSUED", ["CHANGE_CARD"], null);
  }
  if (origin.status !== "SUCCEEDED") {
    origin.status = "SUCCEEDED";
    ws.pastDue = false;
    ws.renewalPending = false;
    ws.cycle = null;
    ws.currentPaymentId = origin.attemptId;
    ws.subscriptionVersion += 1;
  }
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
  if (!setup) failWith("NOT_FOUND", 404, "요청한 내용을 찾을 수 없습니다.");
  return setup;
}

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

async function submitCard(
  workspaceId: string,
  setupId: string,
  request: Request
) {
  requireAdmin(workspaceId);
  if (currentScenario() === "cardRateLimited")
    failWith(
      "RATE_LIMITED",
      429,
      "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
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
  if (!wellFormed || currentScenario() === "cardInvalid")
    failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
  if (setup.state !== "CREATED")
    failWith("BILLING_IN_PROGRESS", 409, "팀의 구독 처리가 진행 중입니다.");
  const ws = workspaceOf(workspaceId);
  if (setup.scenario === "issueUnknown") {
    setup.state = "ISSUE_UNKNOWN";
    if (ws.mySetupId === setup.setupId) ws.mySetupId = null;
  } else setup.state = "COMPLETING";
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

const BILLING_NOTICES = {
  unpaid: {
    notificationId: "01K0000000090",
    type: "SUBSCRIPTION_ENDED_UNPAID",
  },
  payerLeft: {
    notificationId: "01K0000000091",
    type: "SUBSCRIPTION_BILLING_STOPPED",
  },
  pastDue: {
    notificationId: "01K0000000092",
    type: "SUBSCRIPTION_PAYMENT_DECLINED",
  },
} as const;
function ensureBillingNotice() {
  const scenario = currentScenario();
  const key =
    scenario === "pastDueDecline"
      ? "pastDue"
      : scenario === "unpaid" ||
          scenario === "payerLeft" ||
          scenario === "pastDue"
        ? scenario
        : null;
  if (!key) return;
  mockDb.pushNotification({
    ...BILLING_NOTICES[key],
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

export const billingMock = {
  ensureBillingNotice,
  setScenario(scenario: BillingScenario | null) {
    scenarioOverride = scenario;
  },
  quotaExceeded: () => currentScenario() === "quota",
  setupIds: () => Object.keys(state.setups),
  payments: () =>
    Object.values(state.payments).map(({ workspaceId, paymentId }) => ({
      workspaceId,
      paymentId,
    })),
};
