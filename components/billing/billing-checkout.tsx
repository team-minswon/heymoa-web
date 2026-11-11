"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  BillingNotice,
  TestPaymentNotice,
} from "@/components/billing/billing-parts";
import { BackLink } from "@/components/billing/back-link";
import {
  SETTINGS_LIST,
  SettingsHeader,
} from "@/components/settings/settings-layout";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelBillingSetup,
  useCreateBillingSetup,
} from "@/lib/api/generated/billing/billing";
import { useGetWorkspaceSuspense } from "@/lib/api/generated/workspaces/workspaces";
import { errorCodeOf } from "@/lib/api/error-message";
import { okData } from "@/lib/api/ok-data";
import { planName } from "@/lib/billing/plan-name";
import { billingEvents, useBillingViewerRole } from "@/lib/billing/analytics";
import { leaveToCardRegistration } from "@/lib/billing/navigate";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { createRequestKey } from "@/lib/billing/request-key";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { useWorkspaceBilling } from "@/lib/billing/use-workspace-billing";

type Purpose = "PURCHASE" | "REPLACE";

/**
 * 설정 창 안의 주문 확인·동의(구매 `PURCHASE`)와 카드 변경(`REPLACE`). 카드 변경은 카드만 새로 등록하고 지금 청구하지 않는다
 * (문구·분석·진입 조건이 구매와 갈린다). **금액·상품은 서버 응답만 그린다**(화면에 값을 적어 두지 않는다).
 * 동의 전에는 구매할 수 없다. requestKey 는 이 화면이 사용자의 한 번의 의도마다 하나 만든다(`createRequestKey`).
 * 카드 입력만 결제 대행사 창으로 나가고, 돌아오면 등록 결과 화면(`/billing/setups/{id}`)이 받는다.
 */
export function BillingCheckout({
  workspaceId,
  purpose,
  onBack,
}: {
  workspaceId: string;
  purpose: Purpose;
  /** 들어온 탭(요금제·결제 관리)의 첫 화면으로. */
  onBack: () => void;
}) {
  const t = useTranslations("billing.checkout");
  const replace = purpose === "REPLACE";
  const role = useBillingViewerRole(workspaceId);
  useEffect(() => {
    if (role && !replace) billingEvents.checkoutEntered(workspaceId, role);
  }, [workspaceId, role, replace]);
  return (
    <div>
      <BackLink onClick={onBack}>
        {replace ? t("replace.back") : t("back")}
      </BackLink>
      <SettingsHeader
        title={replace ? t("replace.title") : t("title")}
        description={replace ? t("replace.description") : t("description")}
      />
      <DataBoundary
        resetKeys={[workspaceId]}
        fallback={
          <Skeleton
            aria-label={replace ? t("replace.loading") : t("loading")}
            className="h-80 w-full rounded-panel"
          />
        }
      >
        <CheckoutContent
          workspaceId={workspaceId}
          purpose={purpose}
          onBack={onBack}
        />
      </DataBoundary>
    </div>
  );
}

type Notice = "stateChanged" | "inProgress" | "unsupported";

function CheckoutContent({
  workspaceId,
  purpose,
  onBack,
}: {
  workspaceId: string;
  purpose: Purpose;
  onBack: () => void;
}) {
  const replace = purpose === "REPLACE";
  const t = useTranslations("billing.checkout");
  const format = useBillingFormat();
  const queryClient = useQueryClient();
  const billing = useWorkspaceBilling(workspaceId);
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);
  const key = useRef(createRequestKey()).current;
  const [agreed, setAgreed] = useState(false);
  // 체크·해제를 되풀이해도 동의 이벤트는 화면당 한 번만 낸다.
  const agreementTracked = useRef(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // 카드 등록 정보(`registration`)는 처음 만들 때 한 번만 내려온다 — 다시 받은 진행 중 등록은 이어 갈 수 없다.
  const [reusedSetupId, setReusedSetupId] = useState<string | null>(null);
  const create = useCreateBillingSetup({
    mutation: {
      meta: {
        suppressErrorToast: ["BILLING_STATE_CHANGED", "BILLING_IN_PROGRESS"],
      },
    },
  });
  const cancel = useCancelBillingSetup();

  const product = billing.product;
  const admin = workspace?.role === "ADMIN";
  const openSetupId = reusedSetupId ?? billing.mySetupId;

  if (!billing.enforced) {
    return <BillingNotice>{t("notEnforced")}</BillingNotice>;
  }
  if (!admin)
    return (
      <BillingNotice>
        {replace ? t("replace.askAdmin") : t("askAdmin")}
      </BillingNotice>
    );
  if (billing.teamSetupInProgress)
    return <BillingNotice>{t("inProgress")}</BillingNotice>;
  if (
    !product ||
    (!billing.allowedActions.includes(
      replace ? "CHANGE_CARD" : "START_PURCHASE"
    ) &&
      !openSetupId)
  ) {
    return (
      <BillingNotice>
        <p>{replace ? t("replace.unavailable") : t("unavailable")}</p>
        <Button variant="outline" className="mt-3" onClick={onBack}>
          {replace ? t("replace.back") : t("backToPlans")}
        </Button>
      </BillingNotice>
    );
  }
  // 자동 갱신 동의는 금액과 주기를 문장에 직접 적는다.
  const agreementLabel = t(
    replace ? "replace.agreementLabel" : "agreementLabel",
    { amount: format.money(product.amountKrw) }
  );

  const start = async () => {
    setNotice(null);
    try {
      const response = await create.mutateAsync({
        workspaceId,
        data: {
          requestKey: key.current(),
          purpose,
          expectedProductVersion: product.policyVersion,
          agreementVersion: product.agreementVersion,
        },
      });
      const setup = response.data.data;
      if (!setup) return;
      const registration = setup.registration;
      if (registration?.redirectUrl) {
        key.renew();
        if (replace) billingEvents.cardChangeStarted(workspaceId);
        else billingEvents.cardSetupStarted(workspaceId, setup.provider);
        leaveToCardRegistration(registration.redirectUrl);
        return;
      }
      if (registration) {
        // SDK 파라미터만 주는 PG(토스)는 이번 범위가 아니다. 열어 둔 등록이 다음 구매를 막지 않게 닫는다.
        key.renew();
        setNotice("unsupported");
        await cancel
          .mutateAsync({ workspaceId, setupId: setup.setupId })
          .catch(() => undefined);
        return;
      }
      setReusedSetupId(setup.setupId);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === "BILLING_STATE_CHANGED") {
        // 화면이 본 상품·상태가 서버와 다르다 — 새로 읽고 동의를 다시 받는다(같은 키에 다른 본문은 충돌이라 키도 새로).
        key.renew();
        setAgreed(false);
        setNotice("stateChanged");
        await invalidateWorkspaceBilling(queryClient, workspaceId);
      } else if (code === "BILLING_IN_PROGRESS") {
        setNotice("inProgress");
        await invalidateWorkspaceBilling(queryClient, workspaceId);
      } else if (code === "REQUEST_KEY_CONFLICT") {
        key.renew();
      }
    }
  };

  const restart = async () => {
    if (!openSetupId) return;
    const closed = await cancel
      .mutateAsync({ workspaceId, setupId: openSetupId })
      .then(() => true)
      .catch(() => false);
    if (!closed) return;
    setReusedSetupId(null);
    key.renew();
    await invalidateWorkspaceBilling(queryClient, workspaceId);
    if (agreed) await start();
  };

  const period = billing.currentPeriod;
  const card = format.card(billing.detail?.maskedCard);
  const points = replace
    ? [
        t("replace.noCharge"),
        t("replace.keepOnFail"),
        billing.status === "PAST_DUE" ? t("replace.pastDue") : null,
      ]
    : [
        format.allowance(product.recordingAllowanceMinutes),
        t("shared"),
        t("autoRenew"),
        t("cancelInfo"),
      ];
  return (
    <div className="flex flex-col gap-6">
      <div className={SETTINGS_LIST}>
        <div className="flex items-center justify-between gap-4 px-5 py-5">
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-[var(--el-ink)]">
              {replace
                ? (workspace?.name ?? "")
                : t("productName", { plan: planName(product.planCode) })}
            </p>
            <p className="mt-1 truncate text-sm text-[var(--el-muted)]">
              {replace
                ? t("replace.summary", { plan: planName(product.planCode) })
                : (workspace?.name ?? "")}
            </p>
          </div>
          {replace ? null : (
            <p className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-[28px] leading-8 font-light tracking-[-0.03em] text-[var(--el-ink)]">
                {format.money(product.amountKrw)}
              </span>
              <span className="text-sm text-[var(--el-muted)]">
                {t("perMonth")}
              </span>
            </p>
          )}
        </div>
        {replace && (card || (billing.status === "ACTIVE" && period)) ? (
          <dl className="grid gap-2.5 px-5 py-4 text-sm">
            {card ? <Row label={t("replace.current")} value={card} /> : null}
            {billing.status === "ACTIVE" &&
            !billing.cancelAtPeriodEnd &&
            period ? (
              <Row
                label={t("replace.nextCharge")}
                value={`${format.date(period.end)} · ${format.money(product.amountKrw)}`}
              />
            ) : null}
          </dl>
        ) : null}
        <ul className="grid gap-2.5 px-5 py-4 text-sm leading-5 text-[var(--el-body)]">
          {points.filter(Boolean).map((point) => (
            <li key={point} className="flex items-start gap-2">
              <Check
                className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]"
                aria-hidden
              />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        {replace ? null : (
          <div className="flex items-baseline justify-between gap-4 bg-[var(--el-canvas-soft)] px-5 py-3.5 text-sm">
            <span className="text-[var(--el-muted)]">{t("dueToday")}</span>
            <span className="font-medium whitespace-nowrap text-[var(--el-ink)]">
              {format.money(product.amountKrw)}
            </span>
          </div>
        )}
      </div>
      {replace ? null : (
        <TestPaymentNotice notice={product.testPaymentNotice ?? undefined} />
      )}
      {openSetupId ? (
        <BillingNotice tone="warn" title={t("openSetup.title")}>
          <p>{t("openSetup.body")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton
              href={`/billing/setups/${openSetupId}`}
              variant="outline"
            >
              {t("openSetup.view")}
            </LinkButton>
            <Button onClick={restart} loading={cancel.isPending}>
              {t("openSetup.restart")}
            </Button>
          </div>
        </BillingNotice>
      ) : null}
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-[var(--el-ink)]">
          <Checkbox
            className="mt-0.5"
            checked={agreed}
            onCheckedChange={(checked) => {
              setAgreed(checked);
              if (checked && !agreementTracked.current && !replace) {
                agreementTracked.current = true;
                billingEvents.agreementAccepted(workspaceId);
              }
            }}
            aria-label={agreementLabel}
          />
          <span>{agreementLabel}</span>
        </label>
        {notice ? (
          <BillingNotice tone="warn">{t(`notice.${notice}`)}</BillingNotice>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            className="h-10 px-4"
            disabled={!agreed || Boolean(openSetupId)}
            aria-describedby={agreed ? undefined : "billing-agree-hint"}
            loading={create.isPending}
            onClick={start}
          >
            {replace ? t("replace.submit") : t("submit")}
            <ArrowRight aria-hidden />
          </Button>
          <span id="billing-agree-hint" className="sr-only">
            {t("agreeFirst")}
          </span>
        </div>
        <p className="flex items-start gap-1.5 text-xs leading-5 text-[var(--el-muted)]">
          <LockKeyhole className="mt-1 size-3 shrink-0" aria-hidden />
          <span>{t("cardSafe")}</span>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--el-muted)]">{label}</dt>
      <dd className="text-right text-[var(--el-ink)]">{value}</dd>
    </div>
  );
}
