import { http } from "msw";

import { mockDb } from "@/lib/mocks/db";
import { failWith, paramId, respond } from "@/lib/mocks/mock-envelope";

/**
 * 결제 목 (PRO-75 · APP-1564). 서버 계약(`/v1/workspaces/{id}/billing` · `/v1/me/billing/setups/{id}` · 등록 열기·완료·취소 ·
 * 다시 결제)을 화면이 끝까지 따라갈 수 있게 흉내 낸다. **서버·PG 와의 정합성 증거가 아니다** — 상태 전이는 서버 DB·tick 이 아니라
 * 이 파일의 조회 횟수가 정한다.
 *
 * **시드.** 「테스트 유저의 워크스페이스」는 집행 대상·Free, 「제품 팀」은 이미 유료(ACTIVE), 「새 워크스페이스」는 집행 대상이
 * 아니다(`enforced=false`).
 *
 * **구매 흐름.** 등록 열기(201 + `registration.redirectUrl`) → 목은 PG 왕복을 건너뛰어 바로 AUTHORIZED 로 만들고 redirectUrl 을
 * 결과 화면 주소로 준다 → 화면이 complete(202) → 상태를 몇 번 읽는 동안 카드 확인 중 → 결제 확인 중 → 시나리오의 결과.
 * 브라우저가 문서를 새로 열면 목의 메모리가 사라지므로 상태를 sessionStorage 에 남긴다.
 *
 * **재현 시나리오.** 등록을 열 때 `localStorage.mockBilling` 을 읽는다(없으면 `ok`).
 *   - `decline`  결제 확정 거절 → 「다시 결제」(재결제는 성공)
 *   - `unknown`  결제 결과 확인 지연(UNKNOWN)에서 멈춘다 — 새 결제 버튼이 없다
 *   - `stuck`    카드 등록 확인 중에서 멈춘다
 *   - `lost`     첫 조회부터 ACCESS_LOST(관리자 권한 상실)
 *   - `teamBusy` 다른 ADMIN 의 진행 중 구매가 있다(구매 시작 409 `BILLING_IN_PROGRESS`)
 *   - `refund`   승인은 됐지만 권한을 못 줘 자동 취소된다(보상 환불) — 취소 중 → 취소 완료, 새로 시작 가능
 *   - `quota`    무료 월 한도를 다 썼다 — 사용량이 한도와 같고 녹음 시작이 409 `RECORDING_QUOTA_EXCEEDED`(`billingMock.quotaExceeded()`)
 * 지우려면 `localStorage.removeItem("mockBilling")`. 시험은 `billingMock.setScenario(...)`.
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
  | "quota";

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
type Notice = "SIMULATED_NO_CHARGE" | "REAL_CARD_CHARGE_AUTO_CANCEL" | null;
type Setup = {
  setupId: string;
  workspaceId: string;
  scenario: BillingScenario;
  notice: Notice;
  state: "AUTHORIZED" | "COMPLETING" | "CANCELED";
  polls: number;
  retried: boolean;
  retryPolls: number;
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
};
type State = {
  counter: number;
  workspaces: Record<string, Workspace>;
  setups: Record<string, Setup>;
  keys: Record<string, { setupId: string; body: string }>;
};

const STORAGE_KEY = "heymoa:mock-billing";
const PRODUCT = {
  agreementVersion: "BILLING_TEST_V1",
  policyVersion: "TEST_MONTHLY_V1",
  amountKrw: 9900,
  recordingAllowanceMinutes: null as number | null,
  freeRecordingAllowanceMinutes: 1800,
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

let state: State;
let scenarioOverride: BillingScenario | null = null;

function seed(): State {
  const paidCard: Card = FULL_CARD;
  return {
    counter: 0,
    workspaces: {
      "01K0000000000": fresh({ notice: "SIMULATED_NO_CHARGE" }),
      // 이미 유료인 공간 — 실결제(`testPaymentNotice` 없음)로 보인다.
      "01K0000000006": {
        ...fresh({ notice: null }),
        paid: true,
        card: paidCard,
        subscriptionVersion: 2,
      },
      "01K0000000009": { ...fresh({ notice: null }), enforced: false },
    },
    setups: {},
    keys: {},
  };
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
    if (raw) return JSON.parse(raw) as State;
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

function currentScenario(): BillingScenario {
  if (scenarioOverride) return scenarioOverride;
  try {
    const value = globalThis.localStorage?.getItem("mockBilling");
    if (
      value === "decline" ||
      value === "unknown" ||
      value === "stuck" ||
      value === "lost" ||
      value === "teamBusy" ||
      value === "refund" ||
      value === "quota"
    )
      return value;
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
    };
  }
  const attempt = ws.cycle?.attempt ?? null;
  const setup = ws.mySetupId ? state.setups[ws.mySetupId] : null;
  const actions: string[] = [];
  if (setup?.state === "AUTHORIZED")
    actions.push("CONTINUE_SETUP", "CANCEL_SETUP");
  else if (setup) actions.push("REFRESH_STATUS");
  else if (attempt?.status === "FAILED") actions.push("RETRY_PAYMENT");
  else if (attempt) actions.push("REFRESH_STATUS");
  else if (!ws.paid && !teamBusy) actions.push("START_PURCHASE");
  return {
    workspaceId,
    enforced: true,
    status: ws.paid ? "ACTIVE" : "FREE",
    product: { ...PRODUCT, testPaymentNotice: ws.notice },
    entitlement: ws.paid
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
        },
    currentPeriod: ws.paid ? PERIOD : null,
    cancelAtPeriodEnd: false,
    mySetupId: admin ? ws.mySetupId : null,
    teamSetupInProgress: teamBusy,
    latestAttemptStatus: attempt?.status ?? null,
    allowedActions: admin ? actions : [],
    detail: admin
      ? {
          methodVersion: ws.card ? 1 : null,
          maskedCard: ws.card,
          latestAttempt: attemptView(attempt),
          refundedAttempt: attemptView(ws.refunded ?? null),
          subscriptionVersion: ws.subscriptionVersion,
          openCycleId: ws.cycle?.cycleId ?? null,
          methodPayerIsMe: true,
        }
      : null,
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
  if (!ws.enforced) {
    return {
      enforced: false,
      periodKind: null,
      periodStart: null,
      periodEnd: null,
      unlimited: null,
      sampleRate: null,
      allowanceSamples: null,
      usedSamples: null,
      reservedSamples: null,
      remainingSamples: null,
      allowanceMinutes: null,
      usedMinutes: null,
      remainingMinutes: null,
    };
  }
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
      reservedSamples: 0,
      remainingSamples: null,
      allowanceMinutes: null,
      usedMinutes: PAID_USED_MINUTES,
      remainingMinutes: null,
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
    reservedSamples: 0,
    remainingSamples: samplesOf(FREE_ALLOWANCE_MINUTES - used),
    allowanceMinutes: FREE_ALLOWANCE_MINUTES,
    usedMinutes: used,
    remainingMinutes: FREE_ALLOWANCE_MINUTES - used,
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
  if (setup.state === "CANCELED")
    return phase("CLOSED", "CANCELED", "CANCELED", [], null);
  if (setup.state === "AUTHORIZED")
    return phase(
      "AUTH_CAPTURED",
      "WAITING",
      "AUTHORIZED",
      ["CONTINUE_SETUP", "CANCEL_SETUP"],
      2
    );
  if (setup.scenario === "lost") {
    return phase("ACCESS_LOST", "ACTION_REQUIRED", "ISSUING", [], null);
  }
  if (setup.scenario === "stuck")
    return phase("BILLING_KEY", "PROCESSING", "ISSUING", ["REFRESH_STATUS"], 2);

  const cycleId = setup.origin?.cycleId ?? nextId("0C");
  if (setup.retried) return advanceRetry(setup, ws);

  const n = setup.polls;
  if (n <= 1)
    return phase("BILLING_KEY", "PROCESSING", "ISSUING", ["REFRESH_STATUS"], 2);
  ws.mySetupId = null;
  ws.card ??=
    setup.scenario === "decline"
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
    origin.status = "FAILED";
    origin.errorCode = "CARD_DECLINED";
    return phase("PAYMENT", "DECLINED", "ISSUED", ["RETRY_PAYMENT"], null);
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
  ws.paid = true;
  ws.cycle = null;
  return phase("COMPLETED", "COMPLETED", "ISSUED", [], null);
}

function advanceRetry(setup: Setup, ws: Workspace): Phase {
  const retry = setup.latest!;
  // 문서를 새로 열면 두 참조가 갈라지므로 매번 같은 시도로 다시 묶는다.
  ws.cycle = { cycleId: retry.cycleId, attempt: retry };
  if (setup.retryPolls <= 1) {
    retry.status = "PROCESSING";
    return phase("PAYMENT", "PROCESSING", "ISSUED", ["REFRESH_STATUS"], 2);
  }
  retry.status = "SUCCEEDED";
  ws.paid = true;
  ws.cycle = null;
  return phase("COMPLETED", "COMPLETED", "ISSUED", [], null);
}

function setupStatus(setup: Setup, tick: boolean) {
  if (tick && setup.state === "COMPLETING") {
    if (setup.retried) setup.retryPolls += 1;
    else setup.polls += 1;
  }
  const p = advance(setup);
  const lost = p.stage === "ACCESS_LOST";
  const completed = p.stage === "COMPLETED";
  return {
    setupId: setup.setupId,
    workspaceId: lost ? null : setup.workspaceId,
    purpose: "PURCHASE",
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
  if (!body.requestKey || body.purpose !== "PURCHASE" || !body.agreementVersion)
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
      setup: createdView(state.setups[stored.setupId], false),
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
  if (ws.paid)
    failWith("BILLING_STATE_CHANGED", 409, "이미 유료 요금제입니다.");
  const mine = ws.mySetupId ? state.setups[ws.mySetupId] : null;
  if (mine) {
    state.keys[`${workspaceId}:${body.requestKey}`] = {
      setupId: mine.setupId,
      body: bodyKey,
    };
    return { setup: createdView(mine, false), status: 200 };
  }
  const setup: Setup = {
    setupId: nextId("0S"),
    workspaceId,
    scenario: currentScenario(),
    notice: ws.notice,
    state: "AUTHORIZED",
    polls: 0,
    retried: false,
    retryPolls: 0,
    origin: null,
    latest: null,
  };
  state.setups[setup.setupId] = setup;
  state.keys[`${workspaceId}:${body.requestKey}`] = {
    setupId: setup.setupId,
    body: bodyKey,
  };
  ws.mySetupId = setup.setupId;
  return { setup: createdView(setup, true), status: 201 };
}

function createdView(setup: Setup, first: boolean) {
  return {
    setupId: setup.setupId,
    purpose: "PURCHASE",
    status: setup.state === "CANCELED" ? "CANCELED" : "AUTHORIZED",
    provider: "FAKE",
    planCode: PRODUCT.planCode,
    amountKrw: PRODUCT.amountKrw,
    currency: PRODUCT.currency,
    recordingAllowanceMinutes: PRODUCT.recordingAllowanceMinutes,
    agreementVersion: PRODUCT.agreementVersion,
    testPaymentNotice: setup.notice,
    expiresAt: "2026-11-11T01:00:00+09:00",
    statusUrl: `/v1/me/billing/setups/${setup.setupId}`,
    // 한 번만 내려온다. 목은 PG 인증 페이지를 건너뛰고 곧장 결과 화면으로 보낸다.
    registration: first
      ? { redirectUrl: `/billing/setups/${setup.setupId}`, parameters: {} }
      : null,
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
  http.get("*/v1/me/billing/setups/:setupId", ({ params }) =>
    respond(() => {
      const view = setupStatus(setupOf(paramId(params.setupId)), true);
      save();
      return view;
    })
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/billing/setups/:setupId/complete",
    ({ params }) =>
      respond(() => {
        const workspaceId = paramId(params.workspaceId);
        requireAdmin(workspaceId);
        const setup = setupOf(paramId(params.setupId));
        // 몇 번 불러도 첫 승인은 하나다 — 이미 시작했으면 그대로 돌려준다.
        if (setup.state === "AUTHORIZED") setup.state = "COMPLETING";
        const view = setupStatus(setup, false);
        save();
        return view;
      }, 202)
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
    "*/v1/workspaces/:workspaceId/billing/cycles/:cycleId/attempts",
    async ({ params, request }) => {
      return respond(async () => {
        const workspaceId = paramId(params.workspaceId);
        requireAdmin(workspaceId);
        const ws = workspaceOf(workspaceId);
        const body = (await request.json().catch(() => ({}))) as {
          requestKey?: string;
          expectedFailedAttemptId?: string;
          expectedVersion?: number;
          methodVersion?: number;
        };
        if (!body.requestKey)
          failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
        const cycle = ws.cycle;
        if (!cycle || cycle.cycleId !== paramId(params.cycleId))
          failWith("BILLING_STATE_CHANGED", 409, "결제 상태가 바뀌었습니다.");
        if (
          cycle.attempt.status === "UNKNOWN" ||
          cycle.attempt.status === "PROCESSING" ||
          cycle.attempt.status === "PENDING"
        )
          failWith("BILLING_IN_PROGRESS", 409, "결제를 확인하는 중입니다.");
        if (
          body.expectedFailedAttemptId !== cycle.attempt.attemptId ||
          body.expectedVersion !== ws.subscriptionVersion ||
          body.methodVersion !== 1
        )
          failWith("BILLING_STATE_CHANGED", 409, "결제 상태가 바뀌었습니다.");
        const next = newAttempt(
          cycle.cycleId,
          cycle.attempt.attemptNumber + 1,
          "PENDING"
        );
        cycle.attempt = next;
        ws.subscriptionVersion += 1;
        const setup = Object.values(state.setups).find(
          (item) =>
            item.workspaceId === workspaceId &&
            item.origin?.cycleId === cycle.cycleId
        );
        if (setup) {
          setup.latest = next;
          setup.retried = true;
          setup.retryPolls = 0;
        }
        save();
        return {
          attemptId: next.attemptId,
          cycleId: next.cycleId,
          attemptNumber: next.attemptNumber,
          status: next.status,
        };
      }, 202);
    }
  ),
];

/** 시험·콘솔용 손잡이. */
export const billingMock = {
  setScenario(scenario: BillingScenario | null) {
    scenarioOverride = scenario;
  },
  /** 시나리오 `quota` 인가 — 녹음 시작 목이 409 를 내는 조건이다. */
  quotaExceeded: () => currentScenario() === "quota",
  setupIds: () => Object.keys(state.setups),
};
