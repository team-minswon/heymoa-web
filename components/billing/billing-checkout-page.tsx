"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  BillingNotice,
  TestPaymentNotice,
} from "@/components/billing/billing-parts";
import {
  BillingScreen,
  BillingSection,
} from "@/components/billing/billing-screen";
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
import { billingEvents } from "@/lib/billing/analytics";
import { leaveToCardRegistration } from "@/lib/billing/navigate";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { createRequestKey } from "@/lib/billing/request-key";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { useWorkspaceBilling } from "@/lib/billing/use-workspace-billing";

/**
 * `/w/{workspaceId}/billing/checkout` — 주문서·동의. **금액·상품은 서버 응답만 그린다**(화면에 값을 적어 두지 않는다).
 * 동의 전에는 구매할 수 없다. requestKey 는 이 화면이 사용자의 한 번의 의도마다 하나 만든다(`createRequestKey`).
 */
export function BillingCheckoutPage({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("billing.checkout");
  useEffect(() => {
    billingEvents.checkoutEntered(workspaceId);
  }, [workspaceId]);
  return (
    <BillingScreen title={t("title")} description={t("description")}>
      <DataBoundary
        resetKeys={[workspaceId]}
        fallback={
          <Skeleton aria-label={t("loading")} className="h-80 w-full" />
        }
      >
        <CheckoutContent workspaceId={workspaceId} />
      </DataBoundary>
    </BillingScreen>
  );
}

type Notice = "stateChanged" | "inProgress" | "unsupported";

function CheckoutContent({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("billing.checkout");
  const format = useBillingFormat();
  const queryClient = useQueryClient();
  const billing = useWorkspaceBilling(workspaceId);
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);
  const key = useRef(createRequestKey()).current;
  const [agreed, setAgreed] = useState(false);
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
  if (!admin) return <BillingNotice>{t("askAdmin")}</BillingNotice>;
  if (billing.teamSetupInProgress)
    return <BillingNotice>{t("inProgress")}</BillingNotice>;
  if (
    !product ||
    (!billing.allowedActions.includes("START_PURCHASE") && !openSetupId)
  ) {
    return (
      <BillingNotice>
        <p>{t("unavailable")}</p>
        <LinkButton
          href={`/w/${workspaceId}/billing`}
          variant="outline"
          className="mt-3"
        >
          {t("backToPlans")}
        </LinkButton>
      </BillingNotice>
    );
  }

  const start = async () => {
    setNotice(null);
    try {
      const response = await create.mutateAsync({
        workspaceId,
        data: {
          requestKey: key.current(),
          purpose: "PURCHASE",
          expectedProductVersion: product.policyVersion,
          agreementVersion: product.agreementVersion,
        },
      });
      const setup = response.data.data;
      if (!setup) return;
      const registration = setup.registration;
      if (registration?.redirectUrl) {
        key.renew();
        billingEvents.cardSetupStarted(workspaceId, setup.provider);
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

  return (
    <div className="flex flex-col gap-10">
      <BillingSection title={t("order")}>
        <dl className="grid gap-3 rounded-panel border border-[var(--el-hairline)] bg-white p-5 text-sm">
          <Row label={t("workspace")} value={workspace?.name ?? ""} />
          <Row
            label={t("product")}
            value={t("productName", { plan: planName(product.planCode) })}
          />
          <Row
            label={t("amount")}
            value={t("amountPerMonth", {
              amount: format.money(product.amountKrw),
            })}
          />
          <Row
            label={t("allowance")}
            value={format.allowance(product.recordingAllowanceMinutes)}
          />
        </dl>
        <ul className="mt-3 grid gap-1 text-sm text-[var(--el-muted)]">
          <li>{t("shared")}</li>
          <li>{t("autoRenew")}</li>
          <li>{t("cancelInfo")}</li>
        </ul>
        <div className="mt-3">
          <TestPaymentNotice notice={product.testPaymentNotice ?? undefined} />
        </div>
      </BillingSection>
      <BillingSection title={t("agreement")}>
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
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-[var(--el-ink)]">
          <Checkbox
            checked={agreed}
            onCheckedChange={(checked) => {
              setAgreed(checked);
              if (checked) billingEvents.agreementAccepted(workspaceId);
            }}
            aria-label={t("agreementLabel")}
          />
          <span>{t("agreementLabel")}</span>
        </label>
        {notice ? (
          <BillingNotice tone="warn" className="mt-4">
            {t(`notice.${notice}`)}
          </BillingNotice>
        ) : null}
        <Button
          className="mt-4"
          disabled={!agreed || Boolean(openSetupId)}
          loading={create.isPending}
          onClick={start}
        >
          {t("submit")}
        </Button>
      </BillingSection>
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
