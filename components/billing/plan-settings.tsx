"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";

import {
  BillingNotice,
  FeedbackLink,
  TestPaymentNotice,
} from "@/components/billing/billing-parts";
import { RecordingUsage } from "@/components/billing/recording-usage";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { CardChangeDialog } from "@/components/billing/card-change-dialog";
import { Button, LinkButton } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useCancelBillingSetup } from "@/lib/api/generated/billing/billing";
import type { WorkspaceBillingResponseData } from "@/lib/api/generated/models";
import { useGetWorkspaceSuspense } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import { billingEvents, useBillingViewerRole } from "@/lib/billing/analytics";
import { refundPending } from "@/lib/billing/payment-status";
import { planName } from "@/lib/billing/plan-name";
import { goToCheckout } from "@/lib/billing/navigate";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { usePollWindow } from "@/lib/billing/use-poll-window";
import {
  billingInProgress,
  useWorkspaceBilling,
} from "@/lib/billing/use-workspace-billing";
import { cn } from "@/lib/utils";

type Billing = WorkspaceBillingResponseData;

/** 현재 요금제 패널. 실제 화면과 skeleton 이 같은 틀을 읽는다(rule `error-loading`). */
const PANEL =
  "grid overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-white md:grid-cols-[minmax(0,1fr)_auto]";
const PANEL_CELL = "p-6";
const PANEL_SIDE =
  "border-t border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-6 md:w-[248px] md:border-t-0 md:border-l";
const LABEL = "text-xs leading-4 text-[var(--el-muted)]";
const FIGURE =
  "text-[40px] leading-[1.1] font-light tracking-[-0.035em] text-[var(--el-ink)]";

/**
 * 설정 › 요금제(PRO-75). 현재 요금제와 이번 달 사용량, 요금제 비교를 한 탭에 둔다. 첫 구독은 분석 없는 전용 결제 페이지
 * (`/billing/checkout/{id}`)로 문서를 새로 열어 가고, 카드 변경은 카드 변경 모달(iframe)이 받는다. 값(가격·제공량·문구 종류)은 전부 서버 응답이다.
 */
export function WorkspacePlanSettings({
  workspaceId,
  onOpenPayment,
}: {
  workspaceId: string;
  /** 「결제 관리」 탭으로. */
  onOpenPayment: () => void;
}) {
  const t = useTranslations("billing.page");
  const role = useBillingViewerRole(workspaceId);
  useEffect(() => {
    if (role) billingEvents.plansViewed(workspaceId, role);
  }, [workspaceId, role]);
  // 첫 구독은 분석 없는 전용 결제 페이지로 문서를 새로 열어 간다(APP-1600). 그 페이지에서는 이벤트를 낼 수 없어 진입은 여기서 낸다.
  const checkout = () => {
    if (role) billingEvents.checkoutEntered(workspaceId, role);
    goToCheckout(workspaceId);
  };
  return (
    <div>
      <SettingsHeader title={t("title")} description={t("description")} />
      <DataBoundary
        resetKeys={[workspaceId]}
        fallback={<PlanSkeleton label={t("loading")} />}
      >
        <PlanContent
          workspaceId={workspaceId}
          onCheckout={checkout}
          onOpenPayment={onOpenPayment}
        />
      </DataBoundary>
    </div>
  );
}

function PlanSkeleton({ label }: { label: string }) {
  const t = useTranslations("billing.page");
  return (
    <div aria-label={label} className="flex flex-col gap-8">
      <div className={PANEL}>
        <div className={PANEL_CELL}>
          <p className={LABEL}>{t("currentLabel")}</p>
          <Skeleton className="mt-2 h-11 w-24" />
          <Skeleton className="mt-3 h-5 w-56" />
        </div>
        <div className={PANEL_SIDE}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-7 w-32" />
          <Skeleton className="mt-4 h-1.5 w-full" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-[var(--el-ink)]">
          {t("compare")}
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-[259px] rounded-panel" />
          <Skeleton className="h-[259px] rounded-panel" />
        </div>
        <IncludedInBoth />
      </div>
    </div>
  );
}

function PlanContent({
  workspaceId,
  onCheckout,
  onOpenPayment,
}: {
  workspaceId: string;
  onCheckout: () => void;
  onOpenPayment: () => void;
}) {
  const poll = usePollWindow();
  // 운영자 환불(OPERATOR)은 미정산 시도가 아니라 `REFRESH_STATUS` 가 없다 — 취소 처리 중이면 같이 다시 읽는다.
  const billing = useWorkspaceBilling(workspaceId, (data) =>
    !poll.expired &&
    data &&
    (billingInProgress(data) ||
      refundPending(data.detail?.refundedAttempt?.refundStatus))
      ? 5000
      : false
  );
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);
  const isAdmin = workspace?.role === "ADMIN";

  const kind = billing.entitlement?.kind;
  const isPaid = kind === "PAID" || kind === "RENEWAL_PENDING";
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <CurrentPlan
          workspaceId={workspaceId}
          billing={billing}
          isAdmin={isAdmin}
          onOpenPayment={onOpenPayment}
        />
        <Attention
          workspaceId={workspaceId}
          billing={billing}
          isAdmin={isAdmin}
          onRestartPolling={poll.restart}
          onCheckout={onCheckout}
        />
      </div>
      <PlanCompare
        billing={billing}
        isPaid={isPaid}
        isAdmin={isAdmin}
        onCheckout={() => {
          onCheckout();
        }}
      />
    </div>
  );
}

/** 왼쪽은 지금 요금제와 그 상태 한 줄, 오른쪽은 이번 달 녹음 사용량. */
function CurrentPlan({
  workspaceId,
  billing,
  isAdmin,
  onOpenPayment,
}: {
  workspaceId: string;
  billing: Billing;
  isAdmin: boolean;
  onOpenPayment: () => void;
}) {
  const t = useTranslations("billing.page");
  const format = useBillingFormat();
  const kind = billing.entitlement?.kind ?? "FREE";
  const planCode = billing.entitlement?.planCode ?? "FREE";
  const period = billing.entitlement?.period ?? billing.currentPeriod;
  const product = billing.product;
  // 다음 결제는 서버가 굳힌 금액이고 ADMIN 에게만 온다(`detail`). 상품가와 다를 수 있어 멤버에게는 날짜만 보인다.
  const nextAmount = billing.detail?.nextChargeAmountKrw;
  const amount = nextAmount != null ? format.money(nextAmount) : null;

  const cancelScheduled =
    billing.cancelAtPeriodEnd && billing.status === "ACTIVE";
  const badge = cancelScheduled ? t("badge.cancelScheduled") : null;
  // 결제자가 나가거나 강등돼 카드가 지워지고 종료가 예약된 구독. 결제 관리 탭의 `stoppedNoCard` 와 같은 상황이다.
  // 카드 유무는 ADMIN 에게만 오는 `detail` 로만 알 수 있다 — 멤버에게는 일반 해지 예약 줄을 보인다.
  const stoppedNoCard = isAdmin && cancelScheduled && !billing.detail?.methodId;

  // RENEWAL_PENDING 은 갱신 결제의 결과를 기다리는 동안의 Pro 다.
  const line =
    kind === "RENEWAL_PENDING"
      ? t("line.renewalPending")
      : cancelScheduled && period
        ? t(
            stoppedNoCard ? "line.stoppedNoCardAdmin" : "line.cancelScheduled",
            // 날짜 한 덩어리가 줄 끝에서 갈리지 않게(rule `ui-text-layout`) 띄어쓰기를 붙는 공백으로.
            // 해지 예약은 기간 경계가 첫 결제 시각이라 시각까지 보인다.
            {
              end: (stoppedNoCard
                ? format.date(period.end)
                : format.dateTime(period.end)
              ).replaceAll(" ", "\u00a0"),
            }
          )
        : billing.status === "ACTIVE" && period && (amount || !isAdmin)
          ? amount
            ? t("line.next", { date: format.date(period.end), amount })
            : t("line.nextDate", { date: format.date(period.end) })
          : planCode === "FREE" && product
            ? t("line.free", {
                allowance: format.duration(
                  product.freeRecordingAllowanceMinutes
                ),
              })
            : period
              ? format.period(period)
              : null;

  return (
    <div className={PANEL}>
      <div className={cn(PANEL_CELL, "flex flex-col")}>
        <p className={LABEL}>{t("currentLabel")}</p>
        <p className="mt-2 flex items-center gap-2.5">
          <span className={FIGURE}>{planName(planCode)}</span>
          {badge ? (
            <span className="rounded-full bg-[var(--el-surface-strong)] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--el-ink)]">
              {badge}
            </span>
          ) : null}
        </p>
        {line ? (
          // 결제자 이탈 안내처럼 세 문장짜리도 있어 줄을 고르게 나누지 않고(`text-balance` 는 칸 폭을 덜 써 어색하게 꺾였다) 칸 폭을 다 쓴다.
          <p className="mt-3 text-sm leading-5 text-pretty text-[var(--el-body)]">
            {line}
          </p>
        ) : null}
        {isAdmin && (billing.detail?.methodId || stoppedNoCard) ? (
          <button
            type="button"
            onClick={onOpenPayment}
            className="mt-4 inline-flex items-center gap-1 self-start text-sm text-[var(--el-muted)] underline-offset-4 hover:text-[var(--el-ink)] hover:underline"
          >
            {t(stoppedNoCard ? "registerCard" : "openPayment")}
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <RecordingUsage
        workspaceId={workspaceId}
        paid={planCode === "PRO"}
        className={PANEL_SIDE}
      />
    </div>
  );
}

const FEATURES = [
  "liveNotes",
  "speakers",
  "links",
  "agentChat",
  "mcp",
] as const;

/**
 * Free 와 유료 상품을 나란히. 두 카드는 같은 줄 구성이고(이름 → 가격 → 한 줄 설명 → 녹음 제공량) 높이가 같다. 두 요금제가
 * 갈리는 것은 녹음 제공량 하나라, 똑같이 갖는 것(멤버 수 · 기능 다섯)은 카드 아래에 한 번만 적는다([IncludedInBoth]).
 * 유료 카드는 어두운 면이고(DESIGN `pricing-tier-featured`), 구매 버튼은 그 카드 안에 있다. 워크스페이스 단위 안내는
 * 항목마다 되풀이하지 않고 맨 아래 한 줄로 둔다(APP-1596).
 */
function PlanCompare({
  billing,
  isPaid,
  isAdmin,
  onCheckout,
}: {
  billing: Billing;
  isPaid: boolean;
  isAdmin: boolean;
  onCheckout: () => void;
}) {
  const t = useTranslations("billing.page");
  const format = useBillingFormat();
  const product = billing.product;
  if (!product) return null;
  const actions = billing.allowedActions;
  const canStart = actions.includes("START_PURCHASE") && !isPaid;
  // 결제 화면은 보이지만(`enforced`) 새 구매가 없다 — 운영자가 새 판매를 멈췄다. 진행 중인 등록·결제·환불이 있어
  // 버튼이 빠진 때와 가른다(그때는 위의 안내가 말한다).
  const salesPaused =
    !canStart &&
    (billing.status === "FREE" || billing.status === "ENDED") &&
    !actions.includes("CONTINUE_SETUP") &&
    !billingInProgress(billing) &&
    !billing.teamSetupInProgress &&
    !refundPending(billing.detail?.refundedAttempt?.refundStatus);
  return (
    <section aria-label={t("compare")}>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        {t("compare")}
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <PlanCard
          name={planName("FREE")}
          price={t("plan.freePrice")}
          tagline={t("plan.freeTagline")}
          highlight={t("plan.recording", {
            allowance: format.monthlyMinutes(
              product.freeRecordingAllowanceMinutes
            ),
          })}
          current={!isPaid}
        />
        <PlanCard
          featured
          name={planName(product.planCode)}
          price={format.money(product.amountKrw)}
          per={t("plan.perMonth")}
          tagline={t("plan.proTagline")}
          highlight={format.allowance(product.recordingAllowanceMinutes)}
          current={isPaid}
          footer={
            isPaid ? null : !isAdmin ? (
              <p className="text-sm leading-5 text-white/70">{t("askAdmin")}</p>
            ) : canStart ? (
              <Button
                onClick={onCheckout}
                className="h-10 w-full bg-white text-[var(--el-ink)] hover:bg-white/90"
              >
                {t("start", { plan: planName(product.planCode) })}
                <ArrowRight aria-hidden />
              </Button>
            ) : salesPaused ? (
              <p className="text-sm leading-5 text-white/70">
                {t("salesPaused")}
              </p>
            ) : null
          }
        />
      </div>
      <IncludedInBoth />
      <div className="mt-3 grid gap-1 text-xs leading-5 text-[var(--el-muted)]">
        <p>{t("plan.footWorkspace")}</p>
      </div>
      <div className="mt-3">
        <TestPaymentNotice notice={product.testPaymentNotice ?? undefined} />
      </div>
    </section>
  );
}

function PlanCard({
  name,
  price,
  per,
  tagline,
  highlight,
  current,
  featured,
  footer,
}: {
  name: string;
  price: string;
  per?: string;
  tagline: string;
  /** 굵게 보이는 첫 항목 — 두 요금제가 갈리는 녹음 제공량. */
  highlight: string;
  current: boolean;
  featured?: boolean;
  footer?: ReactNode;
}) {
  const t = useTranslations("billing.page");
  return (
    <div
      aria-current={current || undefined}
      className={cn(
        "flex flex-col rounded-panel border p-6",
        featured
          ? "border-transparent bg-[var(--el-ink)] text-white"
          : "border-[var(--el-hairline)] bg-white text-[var(--el-ink)]"
      )}
    >
      <div className="flex h-6 items-center justify-between gap-2">
        <h4 className="text-base font-medium">{name}</h4>
        {current ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
              featured
                ? "bg-white/15 text-white"
                : "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
            )}
          >
            {t("plan.current")}
          </span>
        ) : null}
      </div>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[32px] leading-[1.15] font-light tracking-[-0.03em]">
          {price}
        </span>
        {per ? (
          <span
            className={cn(
              "text-sm",
              featured ? "text-white/60" : "text-[var(--el-muted)]"
            )}
          >
            {per}
          </span>
        ) : null}
      </p>
      <p
        className={cn(
          "mt-2 text-sm leading-5",
          featured ? "text-white/70" : "text-[var(--el-muted)]"
        )}
      >
        {tagline}
      </p>
      <p
        className={cn(
          "mt-5 flex items-start gap-2 text-sm leading-5 font-medium",
          featured ? "text-white" : "text-[var(--el-ink)]"
        )}
      >
        <Check
          className={cn(
            "mt-0.5 size-4 shrink-0",
            featured ? "text-white/60" : "text-[var(--el-muted)]"
          )}
          aria-hidden
        />
        <span>{highlight}</span>
      </p>
      {footer ? <div className="mt-auto pt-6">{footer}</div> : null}
    </div>
  );
}

/** 두 요금제가 똑같이 갖는 것. 카드마다 되풀이하지 않고 한 번만 적는다(가격 안내 페이지와 같은 구성). */
function IncludedInBoth() {
  const t = useTranslations("billing.page");
  const items = [
    t("plan.members"),
    ...FEATURES.map((key) => t(`plan.features.${key}`)),
  ];
  return (
    <div className="mt-4 rounded-panel border border-[var(--el-hairline)] px-6 py-5">
      <p className="text-xs text-[var(--el-muted)]">{t("plan.includes")}</p>
      <ul className="mt-3 grid gap-x-6 gap-y-2.5 text-sm leading-5 text-[var(--el-body)] sm:grid-cols-2">
        {items.map((text) => (
          <li key={text} className="flex items-start gap-2">
            <Check
              className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]"
              aria-hidden
            />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 요금제 비교보다 먼저 봐야 하는 것 — 처리 중·이어서 할 등록·환불 진행·구독이 끝난 까닭. 없으면 아무것도 그리지 않는다.
 * 구매 시작은 유료 카드 안의 버튼이 맡는다.
 */
function Attention({
  workspaceId,
  billing,
  isAdmin,
  onRestartPolling,
  onCheckout,
}: {
  workspaceId: string;
  billing: Billing;
  isAdmin: boolean;
  onRestartPolling: () => void;
  /** 첫 구독 결제 페이지로. */
  onCheckout: () => void;
}) {
  const t = useTranslations("billing.page");
  const queryClient = useQueryClient();
  const cancel = useCancelBillingSetup();
  const [cardChange, setCardChange] = useState(false);
  const actions = billing.allowedActions;
  // 카드를 기다리는 내 등록: 구독 중(ACTIVE)이면 카드 변경이고, 아니면 첫 구독이다.
  const replacing = billing.status === "ACTIVE";
  const detail = billing.detail;
  // 갱신 결과를 기다리는 동안(RENEWAL_PENDING)은 현재 요금제 줄이 이미 알리고 사용자가 할 일이 없다 —
  // 「다시 결제하지 마세요」 안내와 「상태 다시 확인」 버튼은 직접 구매한 사람에게만 보인다
  const renewalWait = billing.entitlement?.kind === "RENEWAL_PENDING";
  const checking =
    !renewalWait &&
    (billing.latestAttemptStatus === "PENDING" ||
      billing.latestAttemptStatus === "PROCESSING" ||
      billing.latestAttemptStatus === "UNKNOWN");

  // 승인 뒤 자동 취소(보상 환불, 화면 말로 「결제 취소」)가 걸린 결제. 끝난 취소는 알리지 않는다 — 결과 화면이 이미 알렸고 상태는 Free 로 보인다.
  const refundAttempt = detail?.latestAttempt?.refundStatus
    ? detail.latestAttempt
    : detail?.refundedAttempt;
  const refund = refundAttempt?.refundStatus;
  // 운영자 환불(문의로 받은 환불)은 「환불을 처리하고 있습니다 → 환불이 완료되었습니다」로 따로 말한다(보상 취소와 섞지 않는다).
  const userRefund =
    detail?.refundedAttempt?.refundOrigin === "OPERATOR"
      ? detail.refundedAttempt.refundStatus
      : null;
  const compensation = userRefund ? null : refund;
  const userRefundAttempt = detail?.refundedAttempt;
  // 서버는 지금 유료 기간의 결제를 환불할 때만 다음 결제를 멈추고 구독을 끝낸다. 지난 기간의 결제 환불은 지금 구독과 무관하다.
  const userRefundKey =
    userRefundAttempt?.attemptId === detail?.currentPaymentId
      ? ({ pending: "userRefunding", failed: "userRefundFailed" } as const)
      : ({
          pending: "userPastRefunding",
          failed: "userPastRefundFailed",
        } as const);

  const cancelSetup = async () => {
    if (!billing.mySetupId) return;
    await cancel
      .mutateAsync({ workspaceId, setupId: billing.mySetupId })
      .then(() => invalidateWorkspaceBilling(queryClient, workspaceId))
      .catch(() => undefined);
  };

  const notices = [
    billing.teamSetupInProgress ? (
      <BillingNotice key="team">{t("teamInProgress")}</BillingNotice>
    ) : null,
    checking ? (
      <BillingNotice key="checking" title={t("checking.title")}>
        {t("checking.body")}
      </BillingNotice>
    ) : null,
    refundPending(compensation) ? (
      <BillingNotice key="refunding" tone="warn" title={t("refunding.title")}>
        {t("refunding.body")}
      </BillingNotice>
    ) : null,
    compensation === "FAILED" && refundAttempt ? (
      <BillingNotice
        key="refundFailed"
        tone="warn"
        title={t("refundFailed.title")}
      >
        {t.rich("refundFailed.body", {
          link: (chunks) => (
            <FeedbackLink
              reference={{ type: "payment", id: refundAttempt.attemptId }}
            >
              {chunks}
            </FeedbackLink>
          ),
        })}
      </BillingNotice>
    ) : null,
    refundPending(userRefund) ? (
      <BillingNotice
        key="userRefunding"
        title={t(`${userRefundKey.pending}.title`)}
      >
        {t(`${userRefundKey.pending}.body`)}
      </BillingNotice>
    ) : null,
    userRefund === "SUCCEEDED" && billing.status === "ENDED" ? (
      <BillingNotice key="userRefunded" title={t("userRefunded.title")}>
        {t("userRefunded.body")}
      </BillingNotice>
    ) : null,
    // 환불로 끝난 구독은 위 「환불이 완료되었습니다」가 이미 말한다.
    billing.status === "ENDED" &&
    billing.closedReason &&
    !(billing.closedReason === "REFUNDED" && userRefund === "SUCCEEDED") ? (
      <BillingNotice key="closed">
        {t(`closed.${billing.closedReason}`)}
      </BillingNotice>
    ) : null,
    userRefund === "FAILED" && userRefundAttempt ? (
      <BillingNotice
        key="userRefundFailed"
        tone="warn"
        title={t(`${userRefundKey.failed}.title`)}
      >
        {t.rich(`${userRefundKey.failed}.body`, {
          link: (chunks) => (
            <FeedbackLink
              reference={{ type: "payment", id: userRefundAttempt.attemptId }}
            >
              {chunks}
            </FeedbackLink>
          ),
        })}
      </BillingNotice>
    ) : null,
  ].filter(Boolean);

  const buttons = isAdmin
    ? [
        // 카드를 기다리는 등록을 잇는다(APP-1600) — 카드 변경은 모달, 첫 구독은 결제 페이지. 둘 다 그 등록에 카드를 낸다.
        billing.mySetupId && actions.includes("CONTINUE_SETUP") ? (
          <Button
            key="continue"
            onClick={() => (replacing ? setCardChange(true) : onCheckout())}
          >
            {t("continueSetup")}
          </Button>
        ) : null,
        billing.mySetupId &&
        actions.includes("CONTINUE_SETUP") &&
        actions.includes("CANCEL_SETUP") ? (
          <Button
            key="cancelSetup"
            variant="outline"
            onClick={cancelSetup}
            loading={cancel.isPending}
          >
            {t("cancelSetup")}
          </Button>
        ) : null,
        billing.mySetupId &&
        !actions.includes("CONTINUE_SETUP") &&
        actions.includes("REFRESH_STATUS") ? (
          <LinkButton
            key="viewResult"
            href={`/billing/setups/${billing.mySetupId}`}
            variant="outline"
          >
            {t("viewResult")}
          </LinkButton>
        ) : null,
        actions.includes("REFRESH_STATUS") && !renewalWait ? (
          <Button
            key="refresh"
            variant="outline"
            onClick={() => {
              onRestartPolling();
              void invalidateWorkspaceBilling(queryClient, workspaceId);
            }}
          >
            {t("refresh")}
          </Button>
        ) : null,
      ].filter(Boolean)
    : [];

  if (notices.length === 0 && buttons.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {notices}
      {buttons.length > 0 ? (
        <div className="flex flex-wrap items-start gap-2">{buttons}</div>
      ) : null}
      <CardChangeDialog
        workspaceId={workspaceId}
        open={cardChange}
        register={!detail?.methodId}
        onClose={() => setCardChange(false)}
      />
    </div>
  );
}
