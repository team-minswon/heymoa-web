"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  BillingNotice,
  TestPaymentNotice,
} from "@/components/billing/billing-parts";
import { BackLink } from "@/components/billing/back-link";
import { CardEntryDialog } from "@/components/billing/card-entry-dialog";
import { SitePageLink } from "@/components/heymoa/site-page-link";
import {
  SETTINGS_LIST,
  SettingsHeader,
} from "@/components/settings/settings-layout";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelBillingSetup,
  useCreateBillingSetup,
  useGetWorkspaceBilling,
} from "@/lib/api/generated/billing/billing";
import { useGetWorkspaceSuspense } from "@/lib/api/generated/workspaces/workspaces";
import { errorCodeOf } from "@/lib/api/error-message";
import { okData } from "@/lib/api/ok-data";
import { nextMonthlyChargeAt } from "@/lib/billing/next-charge";
import { planName } from "@/lib/billing/plan-name";
import { billingEvents, useBillingViewerRole } from "@/lib/billing/analytics";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { createRequestKey } from "@/lib/billing/request-key";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { localePath } from "@/lib/i18n/locales";
import { PG_TERMS } from "@/content/billing/pg-terms";
import { useWorkspaceBilling } from "@/lib/billing/use-workspace-billing";

type Purpose = "PURCHASE" | "REPLACE";

/**
 * 설정 창 안의 주문 확인·동의(구매 `PURCHASE`)와 카드 변경(`REPLACE`). 카드 변경은 카드만 새로 등록하고 지금 청구하지 않는다
 * (문구·분석·진입 조건이 구매와 갈린다). **금액·상품은 서버 응답만 그린다**(화면에 값을 적어 두지 않는다).
 * 두 동의가 맞기 전에는 낼 수 없다. requestKey 는 이 화면이 사용자의 한 번의 의도마다 하나 만든다(`createRequestKey`).
 * 나이스페이 정기결제는 결제창이 없어 카드 정보를 우리 화면에서 받는다(APP-1600). **카드 칸은 여기 두지 않는다** — 이 설정 창
 * 문서에는 분석 스크립트가 실려 있다. 등록을 연 뒤 분석이 없는 카드 입력 문서를 iframe 으로 싣는 모달(`CardEntryDialog`)을 띄운다.
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
  // 지금 카드가 없으면(결제자가 빠졌거나 지웠다) 「변경」이 아니라 「등록」이다(APP-1588). 결제 관리에서 들어와 캐시가 있다.
  const billing = okData(useGetWorkspaceBilling(workspaceId).data);
  const copy =
    replace && billing && !billing.detail?.methodId
      ? "replace.register"
      : "replace";
  useEffect(() => {
    if (role && !replace) billingEvents.checkoutEntered(workspaceId, role);
  }, [workspaceId, role, replace]);
  return (
    <div>
      <BackLink onClick={onBack}>
        {replace ? t("replace.back") : t("back")}
      </BackLink>
      <SettingsHeader
        title={replace ? t(`${copy}.title`) : t("title")}
        description={replace ? t(`${copy}.description`) : t("description")}
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

type Notice = "stateChanged" | "inProgress";

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
  const locale = useLocale();
  const format = useBillingFormat();
  const queryClient = useQueryClient();
  const billing = useWorkspaceBilling(workspaceId);
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);
  const key = useRef(createRequestKey()).current;
  const [agreed, setAgreed] = useState(false);
  const [pgAgreed, setPgAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 체크·해제를 되풀이해도 동의 이벤트는 화면당 한 번만 낸다.
  const agreementTracked = useRef(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // 이 화면에서 연 등록. 모달을 닫았다 다시 눌러도 새로 열지 않고 이 등록으로 모달을 연다.
  const openedSetupId = useRef<string | null>(null);
  const [cardSetupId, setCardSetupId] = useState<string | null>(null);
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
  // 카드를 기다리는 내 등록(CONTINUE_SETUP)은 새로 열지 않고 그 등록으로 카드 입력 모달을 연다. 서버가 이미 처리 중인 등록만 「진행 중」으로 알린다.
  const continuable = billing.allowedActions.includes("CONTINUE_SETUP");
  const openSetupId = continuable ? null : billing.mySetupId;

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
      !billing.mySetupId)
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
  // 종료 예정인 구독은 카드를 등록해도 재개하기 전에는 결제되지 않는다 — 동의 문장도 그렇게 말한다.
  const agreementLabel = t(
    !replace
      ? "agreementLabel"
      : billing.cancelAtPeriodEnd
        ? "replace.agreementLabelEnding"
        : "replace.agreementLabel",
    { amount: format.money(product.amountKrw) }
  );
  const ready = agreed && pgAgreed && !openSetupId;

  /** 등록을 열고(이미 열었거나 카드를 기다리는 내 등록이면 그대로) 카드 입력 모달을 연다. 등록 열기 실패는 생성 훅이라 전역 토스트가 띄운다. */
  const submit = async () => {
    if (submitting || !ready) return;
    setSubmitting(true);
    setNotice(null);
    try {
      let setupId =
        openedSetupId.current ?? (continuable ? billing.mySetupId : null);
      if (!setupId) {
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
        key.renew();
        setupId = openedSetupId.current = setup.setupId;
        // 요금제 탭으로 돌아가도 이 등록이 「이어가기」로 보이게 공간 조회를 새로 읽힌다.
        void invalidateWorkspaceBilling(queryClient, workspaceId);
        if (replace) billingEvents.cardChangeStarted(workspaceId);
        else billingEvents.cardSetupStarted(workspaceId, setup.provider);
      }
      setCardSetupId(setupId);
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
    } finally {
      setSubmitting(false);
    }
  };

  const restart = async () => {
    if (!openSetupId) return;
    const closed = await cancel
      .mutateAsync({ workspaceId, setupId: openSetupId })
      .then(() => true)
      .catch(() => false);
    if (!closed) return;
    openedSetupId.current = null;
    key.renew();
    await invalidateWorkspaceBilling(queryClient, workspaceId);
  };
  const period = billing.currentPeriod;
  const currentCard = format.card(billing.detail?.maskedCard);
  // 카드가 없으면 「지금 카드」와 「실패하면 지금 카드 유지」가 거짓이다. 남의 카드·카드 없음이면 결제자가 내가 된다.
  const register = !billing.detail?.methodId;
  const nextCharge =
    billing.status === "ACTIVE" && !billing.cancelAtPeriodEnd ? period : null;
  const points = replace
    ? [
        t(register ? "replace.register.noCharge" : "replace.noCharge"),
        register ? null : t("replace.keepOnFail"),
        billing.detail?.methodPayerIsMe === true
          ? null
          : t("replace.payerChanges"),
      ]
    : [format.allowance(product.recordingAllowanceMinutes), t("shared")];
  // 혜택(체크)과 결제 조건(점)을 가른다 — 둘 다 체크면 해지 규칙까지 혜택처럼 읽힌다(APP-1596).
  const terms = replace
    ? []
    : [t("autoRenew"), t("cancelInfo"), t("cancelHow")];
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
        {replace && (currentCard || nextCharge) ? (
          <dl className="grid gap-2.5 px-5 py-4 text-sm">
            {currentCard ? (
              <Row label={t("replace.current")} value={currentCard} />
            ) : null}
            {nextCharge ? (
              <Row
                label={t("replace.nextCharge")}
                value={
                  billing.detail?.nextChargeAmountKrw != null
                    ? `${format.date(nextCharge.end)} · ${format.money(billing.detail.nextChargeAmountKrw)}`
                    : format.date(nextCharge.end)
                }
              />
            ) : null}
          </dl>
        ) : null}
        <div className="px-5 py-4 text-sm leading-5 text-[var(--el-body)]">
          <ul className="grid gap-2.5">
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
          {terms.length > 0 ? (
            <>
              <p className="mt-5 text-xs text-[var(--el-muted)]">
                {t("paymentInfo")}
              </p>
              <ul className="mt-2.5 grid gap-2">
                {terms.map((term) => (
                  <li key={term} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mx-1.5 mt-2 size-1 shrink-0 rounded-full bg-[var(--el-muted-soft)]"
                    />
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        {replace ? null : (
          <dl className="grid gap-2.5 bg-[var(--el-canvas-soft)] px-5 py-3.5 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--el-muted)]">{t("dueToday")}</dt>
              <dd className="font-medium whitespace-nowrap text-[var(--el-ink)]">
                {format.money(product.amountKrw)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--el-muted)]">{t("nextCharge")}</dt>
              <dd className="whitespace-nowrap text-[var(--el-ink)]">
                {format.date(nextMonthlyChargeAt(new Date()))}
              </dd>
            </div>
          </dl>
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
        {replace ? null : (
          <p className="text-xs leading-5 text-[var(--el-muted)]">
            {t.rich("refundPolicy", {
              // 새 탭으로 열어 주문서의 동의 상태를 잃지 않는다(`SitePageLink`). 앵커는 약관 제13조(환불).
              link: (chunks) => (
                <SitePageLink
                  href={localePath(locale, "/terms#section-13")}
                  className="whitespace-nowrap underline underline-offset-2 hover:text-[var(--el-ink)]"
                >
                  {chunks}
                </SitePageLink>
              ),
            })}
          </p>
        )}
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
        <div className="flex items-start gap-2.5 text-sm leading-5 text-[var(--el-ink)]">
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              className="mt-0.5"
              checked={pgAgreed}
              onCheckedChange={setPgAgreed}
            />
            <span>{t("pgAgreementLabel")}</span>
          </label>
          <PgTermsDialog />
        </div>
        {notice ? (
          <BillingNotice tone="warn">{t(`notice.${notice}`)}</BillingNotice>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            className="h-10 px-4"
            disabled={!ready}
            aria-describedby={ready ? undefined : "billing-agree-hint"}
            loading={submitting}
            onClick={submit}
          >
            {replace ? t("replace.submit") : t("submit")}
            <ArrowRight aria-hidden />
          </Button>
          <span id="billing-agree-hint" className="sr-only">
            {t("agreeFirst")}
          </span>
        </div>
      </div>
      <CardEntryDialog
        setupId={cardSetupId}
        replace={replace}
        onClose={() => setCardSetupId(null)}
      />
    </div>
  );
}

/** 결제 대행 서비스 이용약관 「내용 보기」. 본문은 문구 파일이 아니라 `content/billing/pg-terms.ts` 다. */
function PgTermsDialog() {
  const t = useTranslations("billing.checkout");
  const locale = useLocale();
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="shrink-0 whitespace-nowrap text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
          />
        }
      >
        {t("pgTermsView")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("pgTermsTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto text-sm leading-6 text-[var(--el-body)]">
          {PG_TERMS[locale === "en" ? "en" : "ko"].map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
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
